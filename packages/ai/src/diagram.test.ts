import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp } from "./diagram.ts";

const node = (id: string, over = {}) => ({
  id, type: "rectangle" as const, label: "A node", x: 0, y: 0, width: 240, height: 96, ...over,
});

test("node count is capped", () => {
  const raw = { title: "t", elements: Array.from({ length: 30 }, (_, i) => node(`n${i}`)), connections: [] };
  assert.equal(clamp(raw).elements.length, 12);
});

test("edges to unknown nodes are dropped", () => {
  const raw = {
    title: "t",
    elements: [node("a"), node("b")],
    connections: [
      { id: "e1", from: "a", to: "b", label: "" },
      { id: "e2", from: "a", to: "ghost", label: "" },
      { id: "e3", from: "a", to: "a", label: "" },
    ],
  };
  assert.deepEqual(clamp(raw).connections.map((c) => c.id), ["e1"]);
});

test("sizes are clamped into renderable bounds", () => {
  const out = clamp({ title: "t", elements: [node("a", { width: 9999, height: 1 })], connections: [] });
  assert.equal(out.elements[0]!.width, 300);
  assert.equal(out.elements[0]!.height, 80);
});

test("ids are slugged so edges can match them", () => {
  const raw = {
    title: "t",
    elements: [node("API Gateway!"), node("Auth Service")],
    connections: [{ id: "e", from: "API Gateway!", to: "Auth Service", label: "calls" }],
  };
  const out = clamp(raw);
  assert.deepEqual(out.elements.map((e) => e.id), ["api-gateway", "auth-service"]);
  assert.equal(out.connections.length, 1);
});

test("every node gets a colour and a non-empty label", () => {
  const out = clamp({ title: "", elements: [node("a", { label: "   " })], connections: [] });
  assert.match(out.elements[0]!.stroke, /^#/);
  assert.equal(out.elements[0]!.label, "Step 1");
  assert.equal(out.title, "Diagram");
});
