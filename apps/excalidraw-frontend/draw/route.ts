import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { Shape } from ".";
import { replayEvents } from "./replay";

export type BoardLoad = { shapes: Shape[]; tailLength: number; lastEventId: number };

export async function getExistingShape(roomId: string): Promise<BoardLoad> {
  const res = await axios.get(`${HTTP_BACKEND}/rooms/${roomId}/board`);
  const events: string[] = res.data.events;

  return {
    shapes: replayEvents(events, res.data.shapes ?? []),
    tailLength: events.length,
    lastEventId: res.data.lastEventId ?? 0,
  };
}
