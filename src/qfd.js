export const label = (score) =>
  score <= -0.3 ? "Negative" : score >= 0.3 ? "Positive" : "Neutral";

// Build primary > secondary > tertiary tree. Names merge case/whitespace-insensitively; first spelling wins.
// ponytail: exact-after-normalize merge only; add fuzzy matching if near-duplicate names show up.
export function buildTree(statements, assignments) {
  const key = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const child = (list, name, make) => {
    let node = list.find((n) => key(n.name) === key(name));
    if (!node) list.push((node = make(name.trim())));
    return node;
  };
  const tree = [];
  for (const s of statements) {
    const a = assignments.get(s.id);
    if (!a) continue;
    const p = child(tree, a.primary, (name) => ({ name, children: [] }));
    const sec = child(p.children, a.secondary, (name) => ({
      name,
      children: [],
    }));
    const ter = child(sec.children, a.tertiary, (name) => ({
      name,
      statements: [],
    }));
    ter.statements.push({ text: s.text, score: s.score });
  }
  return tree;
}

// Relative importance per primary attribute: share of total |score|, in %.
export function importance(tree) {
  const sums = tree.map((p) => [
    p.name,
    p.children
      .flatMap((s) => s.children)
      .flatMap((t) => t.statements)
      .reduce((sum, st) => sum + Math.abs(st.score), 0),
  ]);
  const total = sums.reduce((t, [, v]) => t + v, 0);
  return Object.fromEntries(
    sums
      .map(([n, v]) => [n, total ? Math.round((v / total) * 10000) / 100 : 0])
      .sort((a, b) => b[1] - a[1]),
  );
}
