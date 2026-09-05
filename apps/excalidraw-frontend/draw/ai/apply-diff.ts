import type { Shape } from "..";
import type { EditDiff } from "@repo/ai";

export type Status = "applicable" | "stale" | "orphaned";

export type Change =
  | { kind: "add"; status: "applicable"; shape: Shape; describe: string }
  | { kind: "modify"; status: Status; id: string; field: string; value: string; describe: string }
  | { kind: "remove"; status: Status; id: string; describe: string };

const NUMERIC = new Set(["x", "y", "width", "height", "strokeWidth", "fontSize"]);

// The whole point of the proposal model: the diff was computed against a board
// that is seconds old, so every target is re-checked against live state.
export function classifyDiff(
  diff: EditDiff,
  byAlias: Map<string, Shape>,
  current: Shape[],
): Change[] {
  const live = new Map(current.filter((s) => s.id).map((s) => [s.id!, s]));
  const changes: Change[] = [];

  for (const a of diff.add) {
    changes.push({
      kind: "add",
      status: "applicable",
      shape: toShape(a),
      describe: `Add ${a.type} "${a.label}"`,
    });
    if (a.label && a.type !== "text") {
      changes.push({
        kind: "add",
        status: "applicable",
        shape: { type: "text", x: a.x + 16, y: a.y + a.height / 2, text: a.label, fontSize: 16 },
        describe: `Label "${a.label}"`,
      });
    }
  }

  for (const m of diff.modify) {
    const target = byAlias.get(m.ref);
    const status = statusOf(target, m.version, live);
    changes.push({
      kind: "modify",
      status,
      id: target?.id ?? m.ref,
      field: m.field,
      value: m.value,
      describe: `Set ${m.field} to ${m.value} on ${labelOf(target, m.ref)}`,
    });
  }

  for (const r of diff.remove) {
    const target = byAlias.get(r.ref);
    changes.push({
      kind: "remove",
      status: statusOf(target, r.version, live),
      id: target?.id ?? r.ref,
      describe: `Remove ${labelOf(target, r.ref)}`,
    });
  }

  return changes;
}

function statusOf(target: Shape | undefined, sawVersion: number, live: Map<string, Shape>): Status {
  if (!target?.id) return "orphaned";
  const now = live.get(target.id);
  if (!now) return "orphaned";
  // Someone edited it while the model was thinking.
  if ((now.version ?? 0) > sawVersion) return "stale";
  return "applicable";
}

function labelOf(s: Shape | undefined, fallback: string) {
  if (!s) return fallback;
  return s.type === "text" ? `"${s.text}"` : s.type;
}

export function applyToShape(shape: Shape, field: string, value: string): Shape {
  const parsed = NUMERIC.has(field) ? Number(value) : value;
  if (NUMERIC.has(field) && !Number.isFinite(parsed as number)) return shape;
  return { ...shape, [field]: parsed } as Shape;
}

function toShape(a: EditDiff["add"][number]): Shape {
  if (a.type === "ellipse") {
    return {
      type: "ellipse",
      centerX: a.x + a.width / 2,
      centerY: a.y + a.height / 2,
      rx: a.width / 2,
      ry: a.height / 2,
      color: "#2563eb",
      fillColor: "#dbeafe",
      strokeWidth: 2,
    };
  }
  if (a.type === "text") {
    return { type: "text", x: a.x, y: a.y, text: a.label, fontSize: 16 };
  }
  if (a.type === "arrow") {
    return { type: "arrow", startX: a.x, startY: a.y, endX: a.x + a.width, endY: a.y + a.height, color: "#64748b", strokeWidth: 2 };
  }
  return {
    type: a.type === "diamond" ? "diamond" : "rect",
    x: a.x, y: a.y, width: a.width, height: a.height,
    color: "#2563eb", fillColor: "#dbeafe", strokeWidth: 2,
  };
}
