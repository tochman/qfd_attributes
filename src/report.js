import { label } from "./qfd.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Plain text from the LLM -> paragraphs and bullet lists. **bold** is kept.
function prose(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.trim().split("\n");
      const fmt = (l) =>
        esc(l).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (lines.every((l) => /^\s*[-*•]\s/.test(l)))
        return `<ul>${lines.map((l) => `<li>${fmt(l.replace(/^\s*[-*•]\s/, ""))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(fmt).join("<br>")}</p>`;
    })
    .join("\n");
}

const sentimentClass = (score) => label(score).toLowerCase();

export function renderReport({ domain, analysis, tree, weights, statements }) {
  const rows = tree.flatMap((p) =>
    p.children.flatMap((s) =>
      s.children.map(
        (t) =>
          `<tr><td>${esc(p.name)}</td><td>${esc(s.name)}</td><td>${esc(t.name)}</td><td><ul>${t.statements
            .map(
              (st) =>
                `<li class="${sentimentClass(st.score)}">${esc(st.text)} <small>(${st.score.toFixed(2)})</small></li>`,
            )
            .join("")}</ul></td></tr>`,
      ),
    ),
  );
  const max = Math.max(...Object.values(weights), 1);
  const bars = Object.entries(weights)
    .map(
      ([n, w]) =>
        `<div class="bar"><span>${esc(n)}</span><div style="width:${(w / max) * 100}%"></div><b>${w}%</b></div>`,
    )
    .join("");
  const appendix = [...statements]
    .sort((a, b) => a.score - b.score)
    .map(
      (s) =>
        `<tr class="${sentimentClass(s.score)}"><td>${esc(s.text)}</td><td>${s.score.toFixed(2)}</td><td>${label(s.score)}</td></tr>`,
    )
    .join("");
  const section = (h, body) => `<h2>${h}</h2>${prose(body)}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(analysis.title)}</title>
<style>
  body { font: 16px/1.55 system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1d2433; }
  h1 { line-height: 1.2 } h2 { margin-top: 2.5rem; border-bottom: 1px solid #dde; padding-bottom: .3rem }
  table { border-collapse: collapse; width: 100%; font-size: 14px } td, th { border: 1px solid #dde; padding: .4rem; vertical-align: top; text-align: left }
  th { background: #f3f5fa } td ul { margin: 0; padding-left: 1.1rem }
  .positive { color: #1a7f37 } .negative { color: #c0392b } .neutral { color: #6b7280 }
  .bar { display: grid; grid-template-columns: minmax(8rem, 16rem) 1fr 4rem; gap: .6rem; align-items: center; margin: .35rem 0 }
  .bar div { height: 1.1rem; background: #3b6fd8; border-radius: 3px } .bar b { font-variant-numeric: tabular-nums }
  .wrap { overflow-x: auto } @media print { h2 { break-after: avoid } tr { break-inside: avoid } }
</style></head><body>
<h1>${esc(analysis.title)}</h1>
<p><small>Domain: ${esc(domain)} · ${statements.length} relevant statements · generated ${new Date().toISOString().slice(0, 10)}</small></p>
${section("Introduction", analysis.introduction)}
${section("Introduction to Derived Customer Attributes", analysis.derived_attributes_introduction)}
${section("Analysis", analysis.analysis)}
${section("Recommendations", analysis.recommendations)}
${section("Conclusion", analysis.conclusions)}
<h2>Relative Importance of Primary Attributes</h2>${bars}
<h2>Customer Attribute Breakdown</h2>
<div class="wrap"><table><tr><th>Primary</th><th>Secondary</th><th>Tertiary</th><th>Statements (score)</th></tr>${rows.join("")}</table></div>
<h2>Appendix: Statements by Sentiment</h2>
<div class="wrap"><table><tr><th>Statement</th><th>Score</th><th>Sentiment</th></tr>${appendix}</table></div>
</body></html>`;
}
