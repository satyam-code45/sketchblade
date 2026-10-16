import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeBoard } from "./serialize-board.ts";
import type { Shape } from "../index.ts";

const rect = (id: string, x: number, y: number): Shape =>
  ({ type: "rect", id, x, y, width: 200, height: 80, version: 3 });
const text = (id: string, x: number, y: number, t: string): Shape =>
  ({ type: "text", id, x, y, text: t, version: 1 });

test("text inside a box folds into that box's label", () => {
  const v = serializeBoard([rect("a", 0, 0), text("t", 20, 40, "API Gateway")]);
  assert.match(v.text, /n1 rect "API Gateway" label=n1L at \(0,0\) 200x80 v3/);
  assert.ok(!v.text.includes("t1 text"));
});

test("text outside every box stays loose", () => {
  const v = serializeBoard([rect("a", 0, 0), text("t", 900, 900, "note")]);
  assert.match(v.text, /t1 text "note"/);
});

test("arrows resolve to the nearest boxes at each end", () => {
  const shapes: Shape[] = [
    rect("a", 0, 0),
    rect("b", 400, 0),
    { type: "arrow", id: "e", startX: 200, startY: 40, endX: 400, endY: 40, version: 2 },
  ];
  assert.match(serializeBoard(shapes).text, /e1 n1 -> n2 v2/);
});

test("aliases map back to the real shapes", () => {
  const v = serializeBoard([rect("real-id", 0, 0)]);
  assert.equal(v.byAlias.get("n1")?.id, "real-id");
});

test("ellipses report their bounding box", () => {
  const v = serializeBoard([{ type: "ellipse", id: "e", centerX: 100, centerY: 50, rx: 50, ry: 25, version: 1 }]);
  assert.match(v.text, /n1 ellipse \(unlabelled\) at \(50,25\) 100x50/);
});

test("an empty board says so rather than returning nothing", () => {
  assert.equal(serializeBoard([]).text, "(the board is empty)");
});

test("one label is not claimed by two boxes", () => {
  const v = serializeBoard([rect("a", 0, 0), rect("b", 0, 0), text("t", 20, 40, "shared")]);
  assert.equal(v.text.match(/"shared"/g)?.length, 1);
});

test("a folded label keeps its own alias so it can be edited", () => {
  const v = serializeBoard([rect("a", 0, 0), text("t", 20, 40, "API Gateway")]);
  // Without this the model can only target the box, which holds no text.
  assert.equal(v.byAlias.get("n1L")?.id, "t");
  assert.equal(v.labelOf.get("n1")?.id, "t");
});

test("an unlabelled box has no label alias", () => {
  const v = serializeBoard([rect("a", 0, 0)]);
  assert.equal(v.labelOf.get("n1"), undefined);
  assert.ok(!v.text.includes("label="));
});
