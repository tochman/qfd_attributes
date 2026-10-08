#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { classify, assignAttributes, businessAnalysis } from "./llm.js";
import { buildTree, importance } from "./qfd.js";
import { renderReport } from "./report.js";

const { values: args } = parseArgs({
  options: {
    domain: { type: "string", default: "Healthcare Services" },
    input: { type: "string", default: "data/survey.txt" },
    details: { type: "string", default: "data/survey_details.txt" },
    out: { type: "string", default: "out" },
  },
});

const lines = [
  ...new Set(
    (await readFile(args.input, "utf8"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  ),
];
const details = await readFile(args.details, "utf8").catch(() => "");
let statements = lines.map((text, id) => ({ id, text }));
console.log(`Loaded ${statements.length} statements.`);

const classified = await classify(statements, args.domain);
statements = statements
  .filter((s) => classified.get(s.id)?.relevant)
  .map((s) => ({ ...s, score: Math.max(-1, Math.min(1, classified.get(s.id).score)) }));
console.log(`${statements.length} relevant statements.`);
if (!statements.length) process.exit(1);

const tree = buildTree(
  statements,
  await assignAttributes(statements, args.domain),
);
const weights = importance(tree);
console.table(weights);

console.log("Writing business analysis...");
const analysis = await businessAnalysis({
  domain: args.domain,
  details,
  tree,
  weights,
  total: statements.length,
});

await mkdir(args.out, { recursive: true });
await writeFile(
  `${args.out}/attributes.json`,
  JSON.stringify({ tree, weights }, null, 2),
);
await writeFile(
  `${args.out}/report.html`,
  renderReport({ domain: args.domain, analysis, tree, weights, statements }),
);
console.log(`Done: ${args.out}/report.html and ${args.out}/attributes.json`);
