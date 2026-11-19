import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { readJsonBodyWithLimit } from "@/server/http/body-reader";
import { RateLimiter } from "@/server/http/rate-limit";
import { withApi } from "@/server/http/api-handler";

describe("readJsonBodyWithLimit", () => {
  const Schema = z.object({ name: z.string() }).strict();

  function createStreamRequest(bodyStr: string): Request {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(bodyStr);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });

    return new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      // @ts-expect-error duplex required for streaming in node
      duplex: "half",
    });
  }

  function createChunkedStreamRequest(chunks: string[]): Request {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const c of chunks) {
          controller.enqueue(encoder.encode(c));
        }
        controller.close();
      },
    });

    return new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      // @ts-expect-error duplex required for streaming in node
      duplex: "half",
    });
  }

  it("reads and parses valid JSON within byte limit", async () => {
    const req = createStreamRequest(JSON.stringify({ name: "BreatheWise" }));
    const result = await readJsonBodyWithLimit(req, 100, Schema);
    expect(result).toEqual({ name: "BreatheWise" });
  });

  it("handles multi-chunk stream correctly", async () => {
    const req = createChunkedStreamRequest(['{"name":', '"Chunked', 'Name"}']);
    const result = await readJsonBodyWithLimit(req, 100, Schema);
    expect(result).toEqual({ name: "ChunkedName" });
  });

  it("throws 413 PayloadTooLargeError when body exceeds exact byte limit by one byte", async () => {
    const bodyStr = "x".repeat(51);
    const req = createStreamRequest(JSON.stringify({ name: bodyStr }));
    await expect(readJsonBodyWithLimit(req, 50, Schema)).rejects.toThrow(/Payload exceeds limit/);
  });

  it("throws 400 InvalidJsonError on malformed JSON syntax", async () => {
    const req = createStreamRequest("{ malformed: json ");
    await expect(readJsonBodyWithLimit(req, 100, Schema)).rejects.toThrow(/Invalid JSON/);
  });

  it("throws 400 ValidationError on unknown fields and NEVER echoes submitted values", async () => {
    const secretValue = "SUPER_SECRET_TOKEN_DO_NOT_LEAK";
    const req = createStreamRequest(JSON.stringify({ name: "Test", unknownField: secretValue }));

    try {
      await readJsonBodyWithLimit(req, 200, Schema);
      expect.fail("Should have thrown ValidationError");
    } catch (err: unknown) {
      const error = err as AppError;
      expect(error.httpStatus).toBe(400);
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain(secretValue);
      expect(serialized).toContain("unknownField");
    }
  });
});

describe("RateLimiter Sliding Window", () => {
  it("enforces sliding window limits and reports Retry-After", () => {
    let currentTime = 100000;
    const fakeClock = { nowIso: () => new Date(currentTime).toISOString() };
    const limiter = new RateLimiter(fakeClock, "test-salt");

    const key = limiter.hashClientIdentifier("127.0.0.1");

    // Limit of 3
    expect(limiter.check(key, 3).allowed).toBe(true);
    expect(limiter.check(key, 3).allowed).toBe(true);
    expect(limiter.check(key, 3).allowed).toBe(true);

    // 4th request within window rejected
    const blocked = limiter.check(key, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Advance clock past the 60s window
    currentTime += 60001;

    // Allowed again
    expect(limiter.check(key, 3).allowed).toBe(true);
  });

  it("isolates client keys and hashes raw IPs with salt", () => {
    const limiter = new RateLimiter(undefined, "fixed-salt-123");
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    const hash1 = limiter.hashClientIdentifier(ip1);
    const hash2 = limiter.hashClientIdentifier(ip2);

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toContain(ip1);
    expect(hash2).not.toContain(ip2);
  });

  it("prunes expired timestamps to keep memory bounded", () => {
    let currentTime = 1000;
    const fakeClock = { nowIso: () => new Date(currentTime).toISOString() };
    const limiter = new RateLimiter(fakeClock, "salt");

    const key = limiter.hashClientIdentifier("10.0.0.1");
    limiter.check(key, 5);

    // Fast forward 10 minutes
    currentTime += 600000;
    limiter.cleanup(currentTime);

    // Window should be completely clear
    const res = limiter.check(key, 5);
    expect(res.remaining).toBe(4);
  });
});

describe("withApi Route Middleware", () => {
  const DummySchema = z.object({ value: z.number() }).strict();

  it("enforces method allowlist -> 405 with Allow header", async () => {
    const handler = withApi(
      {
        route: "/api/test",
        allowedMethods: ["POST"],
        bodySchema: DummySchema,
      },
      async () => ({ ok: true }),
    );

    const req = new Request("http://localhost:3000/api/test", { method: "GET" });
    const res = await handler(req);

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect(res.headers.get("X-Request-Id")).toBeDefined();
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("method_not_allowed");
  });

  it("enforces cross-origin / same-origin check for POST requests -> 403", async () => {
    const handler = withApi(
      {
        route: "/api/test",
        allowedMethods: ["POST"],
        bodySchema: DummySchema,
      },
      async () => ({ ok: true }),
    );

    // Cross-site Origin
    const req1 = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        Origin: "https://malicious.com",
        Host: "localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 1 }),
    });
    const res1 = await handler(req1);
    expect(res1.status).toBe(403);

    // Sec-Fetch-Site: cross-site
    const req2 = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "Sec-Fetch-Site": "cross-site",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 1 }),
    });
    const res2 = await handler(req2);
    expect(res2.status).toBe(403);
  });

  it("enforces Content-Type application/json -> 415", async () => {
    const handler = withApi(
      {
        route: "/api/test",
        allowedMethods: ["POST"],
        bodySchema: DummySchema,
      },
      async () => ({ ok: true }),
    );

    const req = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "value=1",
    });
    const res = await handler(req);
    expect(res.status).toBe(415);
  });

  it("catches unhandled exceptions and wraps in generic 500 envelope with requestId", async () => {
    const handler = withApi(
      {
        route: "/api/test",
        allowedMethods: ["POST"],
        bodySchema: DummySchema,
      },
      async () => {
        throw new Error("Secret DB connection string: postgres://admin:secret@db.internal");
      },
    );

    const req = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 10 }),
    });
    const res = await handler(req);

    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(json.error.code).toBe("internal_error");
    expect(json.error.message).toBe("An unexpected error occurred. Please try again later.");
    expect(json.error.requestId).toBeDefined();
    // Invariant: NEVER leak internal error message or database connection string
    expect(JSON.stringify(json)).not.toContain("postgres");
    expect(JSON.stringify(json)).not.toContain("secret");
  });

  it("handles handler timeout -> 504", async () => {
    const handler = withApi(
      {
        route: "/api/test",
        allowedMethods: ["POST"],
        bodySchema: DummySchema,
        timeoutMs: 20,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { ok: true };
      },
    );

    const req = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 5 }),
    });
    const res = await handler(req);
    expect(res.status).toBe(504);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("timeout");
  });
});
