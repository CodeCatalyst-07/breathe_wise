import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchJson, sanitizeQueryText, validateCoordinates } from "@/adapters/http";

const TestSchema = z.object({
  status: z.string(),
  value: z.number(),
});

describe("fetchJson HTTP Client", () => {
  it("successfully fetches, parses, and validates JSON response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ status: "ok", value: 42 }),
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ status: "ok", value: 42 });
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns invalid_response when upstream schema validation fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ status: "ok", value: "not-a-number" }),
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.retryable).toBe(false);
    }
  });

  it("returns not_found when upstream returns HTTP 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
      expect(result.error.upstreamStatus).toBe(404);
      expect(result.error.retryable).toBe(false);
    }
  });

  it("retries on HTTP 429 and returns rate_limited after retries exhausted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        "content-type": "application/json",
        "retry-after": "1",
      }),
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      retries: 2,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("rate_limited");
      expect(result.error.upstreamStatus).toBe(429);
      expect(result.error.retryable).toBe(true);
    }
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 500 server error and returns upstream_error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ "content-type": "application/json" }),
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      retries: 1,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_error");
      expect(result.error.upstreamStatus).toBe(503);
      expect(result.error.retryable).toBe(true);
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on HTTP 400 Bad Request client error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
    });
    const sleepFn = vi.fn();

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      retries: 2,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_error");
      expect(result.error.upstreamStatus).toBe(400);
      expect(result.error.retryable).toBe(false);
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>Error page</html>",
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).toContain("Expected JSON content-type");
    }
  });

  it("enforces response size cap", async () => {
    const largePayload = JSON.stringify({ status: "ok", value: 1 }).repeat(100);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => largePayload,
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      maxBytes: 50, // very small cap
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).toContain("exceeds limit");
    }
  });

  it("enforces response size cap via content-length header before reading text", async () => {
    const textSpy = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
        "content-length": "10000",
      }),
      text: textSpy,
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      maxBytes: 100,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).toContain("Response size exceeds limit");
    }
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("handles malformed JSON body gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => "Not Valid JSON {{{",
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_response");
      expect(result.error.message).toContain("Failed to parse response body as JSON");
    }
  });

  it("handles network error retry and returns upstream_error on failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      retries: 2,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_error");
      expect(result.error.message).toContain("Connection reset by peer");
      expect(result.error.retryable).toBe(true);
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("handles Retry-After header with HTTP Date format", async () => {
    const futureDate = new Date(Date.now() + 5000).toUTCString();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        "content-type": "application/json",
        "retry-after": futureDate,
      }),
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      retries: 1,
      fetchFn: mockFetch as unknown as typeof fetch,
      sleepFn,
    });

    expect(result.ok).toBe(false);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn.mock.calls[0]?.[0]).toBeGreaterThan(0);
  });

  it("handles request timeout when signal aborts", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      // Simulate timeout abort
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortError = new Error("This operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const result = await fetchJson("https://api.example.com/test", {
      schema: TestSchema,
      timeoutMs: 10,
      retries: 0,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("timeout");
    }
  });

  describe("validateCoordinates and sanitizeQueryText", () => {
    it("validates coordinates within valid geographic bounds", () => {
      expect(() => validateCoordinates(28.6139, 77.209)).not.toThrow();
      expect(() => validateCoordinates(-90, -180)).not.toThrow();
      expect(() => validateCoordinates(90, 180)).not.toThrow();
      expect(() => validateCoordinates(91, 0)).toThrow(/Invalid latitude/);
      expect(() => validateCoordinates(0, 185)).toThrow(/Invalid longitude/);
    });

    it("sanitizes and truncates query text to maximum allowed length", () => {
      expect(sanitizeQueryText("  Delhi  ")).toBe("Delhi");
      const longQuery = "a".repeat(150);
      expect(sanitizeQueryText(longQuery, 100)).toHaveLength(100);
    });
  });
});
