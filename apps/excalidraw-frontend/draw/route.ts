import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { Shape } from ".";

export type BoardLoad = { shapes: Shape[]; tailLength: number; lastEventId: number };

export async function getExistingShape(roomId: string): Promise<BoardLoad> {
  const res = await axios.get(`${HTTP_BACKEND}/rooms/${roomId}/board`);
  // Already in chronological order (asc by id)
  const events: string[] = res.data.events;
  const shapes: Shape[] = res.data.shapes ?? [];

  for (const payload of events) {
    let data: { shape?: Shape; shapes?: Shape[]; erase?: string[] };
    try {
      data = JSON.parse(payload);
    } catch {
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
      const ids = new Set(data.erase as string[]);
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i] as Shape & { id?: string };
        if (s.id && ids.has(s.id)) shapes.splice(i, 1);
      }
    }
  }

  return { shapes, tailLength: events.length, lastEventId: res.data.lastEventId ?? 0 };
}
