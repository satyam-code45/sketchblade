import { test } from "node:test";
import assert from "node:assert/strict";
import { compileDiagram, wrapLabel, anchorPoints } from "./diagram-to-shapes.ts";

const node = (id: string, over = {}) => ({
  id, type: "rectangle" as const, label: "Node", x: 0, y: 0,
  width: 240, height: 96, stroke: "#111", fill: "#eee", ...over,
});

test("long labels wrap and never exceed three lines", () => {
  const lines = wrapLabel("a fairly long label that keeps on going well past the box", 240);
  assert.ok(lines.length > 1);
  assert.ok(lines.length <= 3);
  lines.forEach((l) => assert.ok(l.length <= 30, l));
});

test("each wrapped line becomes its own text shape", () => {
  const out = compileDiagram(
    { title: "", elements: [node("a", { label: "one two three four five six seven" })], connections: [] },
    { x: 0, y: 0 },
  );
  const texts = out.filter((s) => s.type === "text");
  assert.equal(texts.length, wrapLabel("one two three four five six seven", 240).length);
});

test("ellipse converts from top-left box to centre and radii", () => {
  const out = compileDiagram(
    { title: "", elements: [node("a", { type: "ellipse", x: 100, y: 50, width: 200, height: 80 })], connections: [] },
    { x: 10, y: 20 },
  );
  const e = out.find((s) => s.type === "ellipse") as { centerX: number; centerY: number; rx: number; ry: number };
  assert.deepEqual([e.centerX, e.centerY, e.rx, e.ry], [210, 110, 100, 40]);
});

test("arrows leave the facing edge, not the centre", () => {
  const left = node("l", { x: 0, y: 0 });
  const right = node("r", { x: 400, y: 0 });
  const p = anchorPoints(left, right, { x: 0, y: 0 });
  assert.equal(p.startX, 240);
  assert.equal(p.endX, 400);
  assert.equal(p.startY, 48);

  const below = node("b", { x: 0, y: 300 });
  const v = anchorPoints(left, below, { x: 0, y: 0 });
  assert.equal(v.startY, 96);
  assert.equal(v.endY, 300);
});

test("edges to unknown nodes are skipped rather than throwing", () => {
  const out = compileDiagram(
    { title: "", elements: [node("a")], connections: [{ id: "e", from: "a", to: "ghost", label: "" }] },
    { x: 0, y: 0 },
  );
  assert.equal(out.filter((s) => s.type === "arrow").length, 0);
});

test("origin offsets every shape", () => {
  const out = compileDiagram({ title: "", elements: [node("a")], connections: [] }, { x: 500, y: 300 });
  const rect = out.find((s) => s.type === "rect") as { x: number; y: number };
  assert.deepEqual([rect.x, rect.y], [500, 300]);
});
