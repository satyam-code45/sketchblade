import type { Shape } from ".";

export type Where = "front" | "back" | "forward" | "backward";

// Array order is paint order, so z-order is just a move within the array.
export function reorder(shapes: Shape[], selected: Set<string>, where: Where): Shape[] {
  const isPicked = (s: Shape) => Boolean(s.id && selected.has(s.id));
  const picked = shapes.filter(isPicked);
  if (picked.length === 0) return shapes;

  if (where === "front") return [...shapes.filter((s) => !isPicked(s)), ...picked];
  if (where === "back") return [...picked, ...shapes.filter((s) => !isPicked(s))];

  const next = [...shapes];
  const step = where === "forward" ? 1 : -1;
  // Walk from the edge we are moving toward, or shapes swap past each other.
  const indices = next.map((s, i) => (isPicked(s) ? i : -1)).filter((i) => i >= 0);
  for (const i of step > 0 ? [...indices].reverse() : indices) {
    const j = i + step;
    if (j < 0 || j >= next.length) continue;
    if (isPicked(next[j]!)) continue;
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}
