import { test } from "node:test";
import assert from "node:assert/strict";
import { replayEvents } from "./replay.ts";

const rect = (id: string, x = 0) =>
  JSON.stringify({ shape: { type: "rect", id, x, y: 0, width: 10, height: 10 } });

test("later events with the same id replace, not duplicate", () => {
  const shapes = replayEvents([rect("a", 0), rect("a", 99)]);
  assert.equal(shapes.length, 1);
  assert.equal((shapes[0] as { x: number }).x, 99);
});

test("erase removes shapes by id", () => {
  const shapes = replayEvents([rect("a"), rect("b"), JSON.stringify({ erase: ["a"] })]);
  assert.deepEqual(shapes.map((s) => s.id), ["b"]);
});

test("a batch inserts every shape it carries", () => {
  const batch = JSON.stringify({
    shapes: [
      { type: "rect", id: "x", x: 0, y: 0, width: 1, height: 1 },
      { type: "rect", id: "y", x: 0, y: 0, width: 1, height: 1 },
    ],
  });
  assert.deepEqual(replayEvents([batch]).map((s) => s.id), ["x", "y"]);
});

test("malformed events are skipped, not fatal", () => {
  assert.deepEqual(replayEvents(["{{{", rect("a")]).map((s) => s.id), ["a"]);
});

// The correctness proof for compaction: snapshotting at any point and replaying
// the rest must land on the same board as replaying everything.
test("snapshot plus tail equals a full replay", () => {
  const log = [
    rect("a", 1), rect("b", 2), rect("a", 3),
    JSON.stringify({ erase: ["b"] }),
    rect("c", 4), rect("a", 5),
  ];
  const full = replayEvents(log);

  for (let cut = 0; cut <= log.length; cut++) {
    const snapshot = replayEvents(log.slice(0, cut));
    const compacted = replayEvents(log.slice(cut), snapshot);
    assert.deepEqual(compacted, full, `cut at ${cut}`);
  }
});
