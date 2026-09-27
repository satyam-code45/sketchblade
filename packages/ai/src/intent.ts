import { z } from "zod";

export const IntentSchema = z.object({
  action: z.enum(["generate", "evaluate", "edit", "answer"]),
  // Rewritten as a standalone instruction, with pronouns resolved from history.
  instruction: z.string(),
  reason: z.string(),
});

export type Intent = z.infer<typeof IntentSchema>;

export const INTENT_SYSTEM = `You route a message in a shared drawing room to one action.

generate - they want something new drawn. "draw a checkout flow", "add a diagram of X".
evaluate - they want a critique of what is already there. "what's wrong with this",
           "review it", "is this a good design".
edit     - they want the existing board changed. "add a cache between them",
           "remove the queue", "make it highly available".
answer   - anything else: questions about the board, discussion, greetings.

Rules:
- An empty board cannot be evaluated or edited. Prefer generate or answer.
- Rewrite instruction so it stands alone, resolving "it" and "that" from the history.
- Keep instruction close to their words. Do not invent requirements.
- reason is at most 8 words, for debugging.`;
