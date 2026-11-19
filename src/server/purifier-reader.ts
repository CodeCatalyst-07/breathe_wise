import { z } from "zod";
import { getContainer } from "./container";
import type { PurifierLabelResult } from "@/core/cadr";
import { AppError } from "@/lib/errors";

export const ReadPurifierLabelRequestSchema = z.object({
  imageBase64: z.string().min(100, "Image data is too small to be valid"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type ReadPurifierLabelRequest = z.infer<typeof ReadPurifierLabelRequestSchema>;

/**
 * Validates file signature (magic bytes) from raw base64 buffer.
 */
export function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

export async function processPurifierLabel(
  request: ReadPurifierLabelRequest,
): Promise<PurifierLabelResult> {
  const container = getContainer();

  // Validate base64 payload size and decoding
  const buffer = Buffer.from(request.imageBase64, "base64");
  if (buffer.length > 1.5 * 1024 * 1024) {
    throw new AppError({
      httpStatus: 413,
      code: "payload_too_large",
      message: "Image size exceeds 1.5MB limit",
      userMessage: "Uploaded image is too large. Please upload an image under 1.5MB.",
    });
  }

  if (!validateImageMagicBytes(buffer, request.mimeType)) {
    throw new AppError({
      httpStatus: 400,
      code: "invalid_image_format",
      message: "Image signature does not match declared MIME type",
      userMessage: "Uploaded file format is invalid. Please select a JPEG, PNG, or WebP photo.",
    });
  }

  if (!container.llm?.readPurifierLabel) {
    throw new AppError({
      httpStatus: 501,
      code: "feature_disabled",
      message: "Purifier label reader is not implemented on current provider",
      userMessage: "Purifier label scanning is currently unavailable.",
    });
  }

  const result = await container.llm.readPurifierLabel(request.imageBase64, request.mimeType);
  if (!result.ok) {
    throw new AppError({
      httpStatus: 502,
      code: result.error.code,
      message: result.error.message,
      userMessage: "Could not read purifier specifications from the image.",
    });
  }

  return result.value;
}
