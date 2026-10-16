import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDiff, applyToShape } from "./apply-diff.ts";
import type { Shape } from "../index.ts";

const shape = (id: string, version: number): Shape =>
  ({ type: "rect", id, x: 0, y: 0, width: 100, height: 50, version });

const diff = (over = {}) => ({ rationale: "r", add: [], modify: [], remove: [], ...over });

test("a target untouched since the model saw it is applicable", () => {
  const s = shape("a", 3);
  const changes = classifyDiff(
    diff({ modify: [{ ref: "n1", version: 3, field: "x" as const, value: "50" }] }),
    new Map([["n1", s]]),
    [s],
  );
  assert.equal(changes[0]!.status, "applicable");
});

// The headline case: someone edited it while the model was thinking.
test("a target edited mid-flight is stale", () => {
  const seen = shape("a", 3);
  const now = shape("a", 7);
  const changes = classifyDiff(
    diff({ modify: [{ ref: "n1", version: 3, field: "x" as const, value: "50" }] }),
    new Map([["n1", seen]]),
    [now],
  );
  assert.equal(changes[0]!.status, "stale");
});

test("a target deleted mid-flight is orphaned, not a crash", () => {
  const seen = shape("a", 3);
  const changes = classifyDiff(
    diff({ remove: [{ ref: "n1", version: 3 }] }),
    new Map([["n1", seen]]),
    [],
  );
  assert.equal(changes[0]!.status, "orphaned");
});

test("an alias the model invented is orphaned", () => {
  const changes = classifyDiff(
    diff({ modify: [{ ref: "n99", version: 1, field: "x" as const, value: "0" }] }),
    new Map(),
    [],
  );
  assert.equal(changes[0]!.status, "orphaned");
});

test("mixed diffs classify each entry independently", () => {
  const a = shape("a", 1);
  const b = shape("b", 1);
  const changes = classifyDiff(
    diff({
      modify: [
        { ref: "n1", version: 1, field: "x" as const, value: "10" },
        { ref: "n2", version: 1, field: "x" as const, value: "20" },
      ],
    }),
    new Map([["n1", a], ["n2", b]]),
    [a, shape("b", 9)],
  );
  assert.deepEqual(changes.map((c) => c.status), ["applicable", "stale"]);
});

test("additions are always applicable and carry their label", () => {
  const changes = classifyDiff(
    diff({ add: [{ type: "rect" as const, label: "Cache", x: 0, y: 0, width: 100, height: 50 }] }),
    new Map(),
    [],
  );
  assert.equal(changes.length, 2);
  assert.ok(changes.every((c) => c.status === "applicable"));
});

test("numeric fields are coerced and nonsense is ignored", () => {
  const s = shape("a", 1);
  assert.equal((applyToShape(s, "x", "42") as { x: number }).x, 42);
  assert.equal((applyToShape(s, "x", "banana") as { x: number }).x, 0);
  assert.equal((applyToShape(s, "color", "#fff") as { color: string }).color, "#fff");
});

test("retitling a box is redirected to the text inside it", () => {
  const box = shape("box", 1);
  const label: Shape = { type: "text", id: "lbl", x: 10, y: 10, text: "Old", version: 1 };
  const changes = classifyDiff(
    diff({ modify: [{ ref: "n1", version: 1, field: "text" as const, value: "New" }] }),
    new Map([["n1", box]]),
    [box, label],
    new Map([["n1", label]]),
  );
  assert.equal(changes[0]!.status, "applicable");
  assert.equal((changes[0] as { id: string }).id, "lbl");
});

// Previously this applied silently and the user was told it worked.
test("a field the shape cannot hold is reported, not silently dropped", () => {
  const box = shape("box", 1);
  const changes = classifyDiff(
    diff({ modify: [{ ref: "n1", version: 1, field: "text" as const, value: "New" }] }),
    new Map([["n1", box]]),
    [box],
  );
  assert.equal(changes[0]!.status, "unsupported");
});

test("editing a standalone text still works", () => {
  const t: Shape = { type: "text", id: "t1", x: 0, y: 0, text: "Draft", version: 2 };
  const changes = classifyDiff(
    diff({ modify: [{ ref: "t1", version: 2, field: "text" as const, value: "Final" }] }),
    new Map([["t1", t]]),
    [t],
  );
  assert.equal(changes[0]!.status, "applicable");
});
