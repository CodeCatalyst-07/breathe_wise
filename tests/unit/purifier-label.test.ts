import { describe, expect, it, vi } from "vitest";
import type { GeocodingPort, LlmClient } from "@/core";
import type { Pipeline } from "@/server/pipeline";
import { cfmToM3h, isRealisticCadrM3h } from "@/core/cadr";
import { validateImageMagicBytes, processPurifierLabel } from "@/server/purifier-reader";
import { setContainerForTests, resetContainer } from "@/server/container";
import { JarvisLabsGemmaAdapter } from "@/adapters/jarvislabs-gemma";

describe("Purifier Label Multimodal Reader & CADR Conversions", () => {
  it("converts CFM to m3/h accurately using ASHRAE conversion constant", () => {
    expect(cfmToM3h(100)).toBe(170);
    expect(cfmToM3h(250)).toBe(425);
    expect(cfmToM3h(0)).toBe(0);
    expect(cfmToM3h(-50)).toBe(0);
  });

  it("validates realistic residential CADR values", () => {
    expect(isRealisticCadrM3h(250)).toBe(true);
    expect(isRealisticCadrM3h(450)).toBe(true);
    expect(isRealisticCadrM3h(20)).toBe(true);
    expect(isRealisticCadrM3h(15)).toBe(false);
    expect(isRealisticCadrM3h(1500)).toBe(true);
    expect(isRealisticCadrM3h(2000)).toBe(false);
    expect(isRealisticCadrM3h(null)).toBe(false);
    expect(isRealisticCadrM3h(undefined)).toBe(false);
  });

  it("validates image magic bytes correctly", () => {
    // Valid JPEG (0xFF, 0xD8, 0xFF, ...)
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(validateImageMagicBytes(jpegBuffer, "image/jpeg")).toBe(true);
    expect(validateImageMagicBytes(jpegBuffer, "image/png")).toBe(false);

    // Valid PNG (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(validateImageMagicBytes(pngBuffer, "image/png")).toBe(true);
    expect(validateImageMagicBytes(pngBuffer, "image/jpeg")).toBe(false);

    // Valid WEBP ("RIFF" ... "WEBP")
    const webpBuffer = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00,
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ]);
    expect(validateImageMagicBytes(webpBuffer, "image/webp")).toBe(true);

    // Invalid buffer
    const randomBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    expect(validateImageMagicBytes(randomBuffer, "image/jpeg")).toBe(false);
  });

  it("adapter correctly invokes multimodal completion and converts CFM to m3/h", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  cadr: 200,
                  unit: "cfm",
                  brand: "Coway",
                  model: "AP-1512HH",
                  confidence: "high",
                }),
              },
            },
          ],
        }),
    });

    const adapter = new JarvisLabsGemmaAdapter({
      apiKey: "test-key",
      fetchFn: fakeFetch as unknown as typeof fetch,
    });

    const res = await adapter.readPurifierLabel("dGVzdA==", "image/png");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.brand).toBe("Coway");
    expect(res.value.model).toBe("AP-1512HH");
    expect(res.value.rawCadr).toBe(200);
    expect(res.value.unit).toBe("cfm");
    expect(res.value.cadrM3h).toBe(340); // 200 * 1.69901 = 339.8 -> 340
    expect(res.value.confidence).toBe("high");
  });

  it("processPurifierLabel enforces payload size limits and magic bytes", async () => {
    // 1. Oversized image (> 1.5 MB)
    const largeBuffer = Buffer.alloc(1.6 * 1024 * 1024);
    await expect(
      processPurifierLabel({
        imageBase64: largeBuffer.toString("base64"),
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("Image size exceeds 1.5MB limit");

    // 2. Invalid magic bytes
    const invalidBuffer = Buffer.from("this-is-not-a-valid-jpeg-file-header-content");
    await expect(
      processPurifierLabel({
        imageBase64: invalidBuffer.toString("base64"),
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("Image signature does not match declared MIME type");
  });

  it("processPurifierLabel delegates to container LLM and returns result", async () => {
    const validJpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x00,
    ]);

    // When LLM not configured
    setContainerForTests({
      pipeline: {} as unknown as Pipeline,
      geocoding: {} as unknown as GeocodingPort,
      llm: undefined,
    });
    await expect(
      processPurifierLabel({
        imageBase64: validJpegHeader.toString("base64"),
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("Purifier label reader is not implemented on current provider");

    // When LLM configured and returns success
    const mockLlm = {
      readPurifierLabel: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          cadrM3h: 300,
          brand: "Sharp",
          model: "FP-J30M",
          confidence: "high",
          unit: "m3h",
        },
      }),
    };
    setContainerForTests({
      pipeline: {} as unknown as Pipeline,
      geocoding: {} as unknown as GeocodingPort,
      llm: mockLlm as unknown as LlmClient,
    });

    const result = await processPurifierLabel({
      imageBase64: validJpegHeader.toString("base64"),
      mimeType: "image/jpeg",
    });
    expect(result.cadrM3h).toBe(300);
    expect(result.brand).toBe("Sharp");

    // When LLM returns error
    mockLlm.readPurifierLabel.mockResolvedValueOnce({
      ok: false,
      error: { code: "upstream_error", message: "Gemma inference failed" },
    });
    await expect(
      processPurifierLabel({
        imageBase64: validJpegHeader.toString("base64"),
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("Gemma inference failed");

    resetContainer();
  });
});
