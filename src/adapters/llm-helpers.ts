import { z } from "zod";

export const ChatCompletionResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullish(),
        reasoning_content: z.string().optional(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: z
    .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
    .optional(),
});

export function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match?.[1] ? match[1].trim() : text.trim();
}

export function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
}
