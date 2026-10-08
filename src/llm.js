import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL = "" } = process.env;
// claude-* models go through Anthropic's SDK (reads ANTHROPIC_API_KEY); anything else
// through an OpenAI-compatible endpoint (Gemini, Groq, OpenRouter, Ollama).
const isClaude = LLM_MODEL.startsWith("claude-");
if (!LLM_MODEL || (!isClaude && !LLM_BASE_URL)) {
  throw new Error("Set LLM_MODEL (and LLM_BASE_URL for non-Claude models), see .env.example.");
}

const { ANTHROPIC_WORKSPACE_ID } = process.env;
const client = isClaude
  ? // Keys not scoped to a workspace must name one per request.
    new Anthropic(ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID } } : {})
  : new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY || "none" });

// Returns the model's raw JSON text for `prompt`.
async function complete(prompt, schema) {
  if (isClaude) {
    const haiku = LLM_MODEL.includes("haiku"); // Haiku 4.5 takes neither effort nor fallbacks
    const res = await client.beta.messages.parse({
      model: LLM_MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(schema), ...(haiku ? {} : { effort: "medium" }) },
      // If a safety classifier declines, Anthropic re-runs the request on a fallback model.
      ...(haiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
    });
    if (res.stop_reason === "refusal") throw new Error("Claude declined the request");
    if (!res.parsed_output) throw new Error(`No parsable output (stop_reason: ${res.stop_reason})`);
    return JSON.stringify(res.parsed_output);
  }
  const res = await client.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, "");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every validated reply is saved under .cache/, keyed by model + prompt, so a rerun
// replays finished steps for free and only calls the API for what failed.
// Delete .cache/ to force fresh answers.
const CACHE = ".cache";

// Ask for JSON, validate with zod, retry on bad output or API errors.
export async function askJson(prompt, schema, retries = 5) {
  const file = `${CACHE}/${createHash("sha256").update(LLM_MODEL + "\n" + prompt).digest("hex").slice(0, 16)}.json`;
  const cached = await readFile(file, "utf8").catch(() => null);
  if (cached) return schema.parse(JSON.parse(cached));

  for (let attempt = 1; ; attempt++) {
    try {
      const text = await complete(prompt, schema);
      const data = schema.parse(JSON.parse(text));
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, text);
      return data;
    } catch (err) {
      // 4xx other than 429 (bad key, bad request) won't fix itself: fail now.
      const fatal = err.status >= 400 && err.status < 500 && err.status !== 429;
      if (fatal || attempt >= retries) {
        if (fatal) console.error(`  ${err.error?.error?.message ?? err.message}`);
        if (err.status === 429)
          console.error("  Still rate limited. Gemini free tier has a per-model daily quota; switch LLM_MODEL or wait. Finished steps are cached in .cache/.");
        throw err;
      }
      // Free-tier quotas are per minute: on 429 wait out the window.
      const wait = err.status === 429 ? 60_000 : 2000 * 2 ** attempt;
      console.warn(
        `  LLM call failed (${(err.error?.error?.message ?? err.message).slice(0, 300)}), retry ${attempt}/${retries - 1} in ${wait / 1000}s`,
      );
      await sleep(wait);
    }
  }
}

const BATCH = 100;

// Run `ask` over items in batches; re-ask for any ids the model skipped.
async function coverAll(items, ask, label) {
  const out = new Map();
  let pending = items;
  for (let round = 1; pending.length && round <= 3; round++) {
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      console.log(
        `${label}: batch ${i / BATCH + 1}/${Math.ceil(pending.length / BATCH)} (round ${round})`,
      );
      const ids = new Set(batch.map((s) => s.id));
      for (const r of await ask(batch)) if (ids.has(r.id)) out.set(r.id, r);
    }
    pending = pending.filter((s) => !out.has(s.id));
  }
  if (pending.length)
    console.warn(
      `${label}: ${pending.length} statements never processed:`,
      pending.map((s) => s.text),
    );
  return out;
}

const list = (batch) => batch.map((s) => `${s.id}: ${s.text}`).join("\n");

const ClassifySchema = z.object({
  results: z.array(
    z.object({
      id: z.coerce.number(),
      relevant: z.boolean(),
      score: z.number(),
    }),
  ),
});

export function classify(statements, domain) {
  return coverAll(
    statements,
    async (batch) =>
      (
        await askJson(
          `
For each customer statement below, decide whether it is relevant to the "${domain}" domain,
and give a sentiment score from -1 (very negative) to +1 (very positive), 0 being neutral.
Analyze every statement. Respond with JSON only:
{"results": [{"id": <number>, "relevant": <true|false>, "score": <number>}]}

Statements (id: text):
${list(batch)}`,
          ClassifySchema,
        )
      ).results,
    "Classify",
  );
}

const AssignSchema = z.object({
  assignments: z.array(
    z.object({
      id: z.coerce.number(),
      primary: z.string(),
      secondary: z.string(),
      tertiary: z.string(),
    }),
  ),
});

// Assigns each statement a primary > secondary > tertiary path. Names seen so far are fed back for consistency.
export async function assignAttributes(statements, domain) {
  const known = new Set();
  return coverAll(
    statements,
    async (batch) => {
      const { assignments } = await askJson(
        `
You are applying Quality Function Deployment (QFD) to customer feedback in the "${domain}" domain.
Assign each statement to exactly one customer attribute path with three levels:
primary (broad need) > secondary (more specific) > tertiary (most specific).

- Reuse existing paths below whenever a statement fits; create new ones only when needed.
- Names must be short, professional, and consistent (Title Case).
- Assign every statement.

Existing paths:
${[...known].join("\n") || "(none yet)"}

Respond with JSON only:
{"assignments": [{"id": <number>, "primary": "...", "secondary": "...", "tertiary": "..."}]}

Statements (id: text):
${list(batch)}`,
        AssignSchema,
      );
      for (const a of assignments)
        known.add(`${a.primary} > ${a.secondary} > ${a.tertiary}`);
      return assignments;
    },
    "Attributes",
  );
}

const AnalysisSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  derived_attributes_introduction: z.string(),
  analysis: z.string(),
  recommendations: z.string(),
  conclusions: z.string(),
});

export function businessAnalysis({ domain, details, tree, weights, total }) {
  return askJson(
    `
You are a business analyst specialized in Quality Function Deployment (QFD). Write a report for
operations management based on customer feedback in the "${domain}" domain.

### Survey details
${details}

### Customer attribute tree (with statements and sentiment scores, -1..+1)
${JSON.stringify(tree, null, 1)}

### Relative importance of primary attributes (% of total absolute sentiment)
${JSON.stringify(weights)}

Total statements: ${total}. Consider all of them.

Respond with JSON only, with these string fields (plain text; separate paragraphs with a blank line,
start bullet points with "- "):
- title: report title
- introduction: background, what it is based on, who it is for, who commissioned/led it
- derived_attributes_introduction: how QFD derives customer attributes from customer statements
- analysis: key findings and insights
- recommendations: actionable to-do items for operations management
- conclusions: high-level conclusion focused on customer satisfaction and quality`,
    AnalysisSchema,
  );
}
