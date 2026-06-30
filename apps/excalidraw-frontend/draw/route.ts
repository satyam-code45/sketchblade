import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { Shape } from ".";

export async function getExistingShape(roomId: string): Promise<Shape[]> {
  const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
  // Messages are already in chronological order (asc by id)
  const messages: { message: string }[] = res.data.messages;

  const shapes: Shape[] = [];

  for (const msg of messages) {
    let data: { shape?: Shape; erase?: string[] };
    try {
      data = JSON.parse(msg.message);
    } catch {
      continue;
    }

    if (data.shape) {
      // Assign fallback id to legacy shapes that were saved before we added ids
      const s = data.shape as Shape & { id?: string };
      if (!s.id) s.id = `_lg_${shapes.length}`;
      shapes.push(s);
    } else if (data.erase && Array.isArray(data.erase)) {
      const ids = new Set(data.erase as string[]);
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i] as Shape & { id?: string };
        if (s.id && ids.has(s.id)) shapes.splice(i, 1);
      }
    }
  }

  return shapes;
}
