import type { Shape } from ".";

type BoardPayload = { shape?: Shape; shapes?: Shape[]; erase?: string[]; reorder?: string[] };

// Rebuilds a board from its event log. Pure so compaction can be proved
// equivalent to a full replay.
export function replayEvents(events: string[], seed: Shape[] = []): Shape[] {
  const shapes: Shape[] = [...seed];

  for (const payload of events) {
    let data: BoardPayload;
    try {
      data = JSON.parse(payload);
    } catch {
      continue;
    }

    if (data.reorder) {
      const order = new Map(data.reorder.map((id, i) => [id, i]));
      shapes.sort((a, b) => (order.get(a.id ?? "") ?? 0) - (order.get(b.id ?? "") ?? 0));
      continue;
    }

    if (data.shape || data.shapes) {
      for (const s of (data.shapes ?? [data.shape!]) as (Shape & { id?: string })[]) {
        // Legacy shapes were saved before ids existed
        if (!s.id) s.id = `_lg_${shapes.length}`;
        // Same id later means a move/resize/recolor — replace, don't duplicate
        const idx = shapes.findIndex((existing) => existing.id === s.id);
        if (idx >= 0) shapes[idx] = s;
        else shapes.push(s);
      }
    } else if (data.erase && Array.isArray(data.erase)) {
      const ids = new Set(data.erase);
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i] as Shape & { id?: string };
        if (s.id && ids.has(s.id)) shapes.splice(i, 1);
      }
    }
  }

  return shapes;
}
