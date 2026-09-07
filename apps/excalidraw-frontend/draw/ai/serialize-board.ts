import type { Shape } from "..";

export type BoardView = { text: string; byAlias: Map<string, Shape> };

type Box = { x: number; y: number; width: number; height: number };

const boxOf = (s: Shape): Box | null => {
  if (s.type === "rect" || s.type === "diamond" || s.type === "image" || s.type === "video") {
    return { x: s.x, y: s.y, width: s.width, height: s.height };
  }
  if (s.type === "ellipse") {
    return { x: s.centerX - s.rx, y: s.centerY - s.ry, width: s.rx * 2, height: s.ry * 2 };
  }
  return null;
};

const inside = (b: Box, x: number, y: number) =>
  x >= b.x && x <= b.x + b.width && y >= b.y - 20 && y <= b.y + b.height;

// A compact semantic view, not raw JSON: roughly a tenth of the tokens and the
// model reads it as a diagram rather than a scene graph.
export function serializeBoard(shapes: Shape[], limit = 60): BoardView {
  const byAlias = new Map<string, Shape>();
  const boxes = shapes.filter((s) => boxOf(s)).slice(0, limit);
  const texts = shapes.filter((s) => s.type === "text") as Extract<Shape, { type: "text" }>[];

  // Fold a text shape into the box it sits in so the model sees a labelled node.
  const claimed = new Set<Shape>();
  const labelFor = (s: Shape) => {
    const b = boxOf(s)!;
    const hits = texts.filter((t) => !claimed.has(t) && inside(b, t.x, t.y));
    hits.forEach((t) => claimed.add(t));
    return hits.map((t) => t.text).join(" ").trim();
  };

  const lines: string[] = [];
  boxes.forEach((s, i) => {
    const alias = `n${i + 1}`;
    byAlias.set(alias, s);
    const b = boxOf(s)!;
    const label = labelFor(s);
    lines.push(
      `${alias} ${s.type} ${label ? `"${label}"` : "(unlabelled)"} at (${Math.round(b.x)},${Math.round(b.y)}) ${Math.round(b.width)}x${Math.round(b.height)} v${s.version ?? 0}`,
    );
  });

  const arrows = shapes.filter((s) => s.type === "arrow" || s.type === "line") as Extract<Shape, { type: "arrow" | "line" }>[];
  arrows.slice(0, limit).forEach((a, i) => {
    const alias = `e${i + 1}`;
    byAlias.set(alias, a);
    const from = nearest(boxes, a.startX, a.startY, byAlias);
    const to = nearest(boxes, a.endX, a.endY, byAlias);
    lines.push(`${alias} ${from ?? "?"} -> ${to ?? "?"} v${a.version ?? 0}`);
  });

  const loose = texts.filter((t) => !claimed.has(t));
  loose.slice(0, 12).forEach((t, i) => {
    const alias = `t${i + 1}`;
    byAlias.set(alias, t);
    lines.push(`${alias} text "${t.text}" at (${Math.round(t.x)},${Math.round(t.y)}) v${t.version ?? 0}`);
  });

  return { text: lines.join("\n") || "(the board is empty)", byAlias };
}

function nearest(boxes: Shape[], x: number, y: number, byAlias: Map<string, Shape>): string | null {
  let best: { alias: string; d: number } | null = null;
  for (const [alias, shape] of byAlias) {
    if (!alias.startsWith("n")) continue;
    const b = boxOf(shape);
    if (!b) continue;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (!best || d < best.d) best = { alias, d };
  }
  return best?.alias ?? null;
}
