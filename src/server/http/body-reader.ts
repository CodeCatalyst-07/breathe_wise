import type { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { InvalidJsonError, PayloadTooLargeError } from "./errors";

/**
 * Safely reads a Request body stream chunk-by-chunk with a strict maximum byte limit.
 * Does NOT trust the incoming Content-Length header.
 *
 * Security Guarantees:
 * - Aborts stream consumption immediately if accumulated byte size exceeds maxBytes (HTTP 413).
 * - Rejects malformed JSON payloads (HTTP 400).
 * - Validates schema and maps validation issues to paths and generic messages only (never echoes user values).
 *
 * @param req - Fetch Request object.
 * @param maxBytes - Maximum permitted body bytes (defaults to 8192 bytes / 8 KB).
 * @param schema - Strict Zod schema for request payload validation.
 * @returns Validated typed payload.
 */
export async function readJsonBodyWithLimit<T>(
  req: Request,
  maxBytes = 8192,
  schema: z.ZodSchema<T>,
): Promise<T> {
  if (!req.body) {
    throw new InvalidJsonError("Missing request body");
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("Payload limit exceeded");
          throw new PayloadTooLargeError(maxBytes);
        }
        chunks.push(value);
      }
    }
  } catch (err: unknown) {
    if (err instanceof PayloadTooLargeError) {
      throw err;
    }
    throw new InvalidJsonError((err as Error).message);
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const rawText = new TextDecoder().decode(concatenated);
  if (rawText.trim() === "") {
    throw new InvalidJsonError("Empty request body");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (err: unknown) {
    throw new InvalidJsonError((err as Error).message);
  }

  const validation = schema.safeParse(json);
  if (!validation.success) {
    // Return only path and message; NEVER echo submitted input values
    const safeIssues = validation.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new ValidationError({
      message: "Request payload failed schema validation",
      userMessage: "Validation error: invalid request payload structure",
      details: safeIssues,
    });
  }

  return validation.data;
}
