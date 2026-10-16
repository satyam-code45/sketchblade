import { test } from "node:test";
import assert from "node:assert/strict";
import { reorder } from "./reorder.ts";
import type { Shape } from "./index.ts";

const s = (id: string): Shape => ({ type: "rect", id, x: 0, y: 0, width: 1, height: 1 });
const ids = (list: Shape[]) => list.map((x) => x.id);
const board = () => [s("a"), s("b"), s("c"), s("d")];

test("front moves the selection to the end of the paint order", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["b"]), "front")), ["a", "c", "d", "b"]);
});

test("back moves it to the start", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["c"]), "back")), ["c", "a", "b", "d"]);
});

test("forward and backward move one step", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["b"]), "forward")), ["a", "c", "b", "d"]);
  assert.deepEqual(ids(reorder(board(), new Set(["c"]), "backward")), ["a", "c", "b", "d"]);
});

test("a shape at the edge stays put instead of falling off", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["d"]), "forward")), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(reorder(board(), new Set(["a"]), "backward")), ["a", "b", "c", "d"]);
});

test("a multi selection keeps its relative order", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["a", "b"]), "front")), ["c", "d", "a", "b"]);
});

test("adjacent selected shapes do not swap past each other", () => {
  assert.deepEqual(ids(reorder(board(), new Set(["b", "c"]), "forward")), ["a", "d", "b", "c"]);
});

test("an empty selection changes nothing", () => {
  assert.deepEqual(ids(reorder(board(), new Set(), "front")), ["a", "b", "c", "d"]);
});
