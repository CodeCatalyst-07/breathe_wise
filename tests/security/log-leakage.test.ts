import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchJson } from "@/adapters/http";

describe("Security Log Leakage Guard", () => {
  it("never logs query parameters containing secret keys, auth tokens, or response bodies", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");

    const sensitiveKey = "super_secret_api_key_xyz987";
    const sensitiveToken = "bearer_auth_token_secret_456";
    const sensitiveBody = "confidential_health_record_asthma_history";

    const sensitiveUrl = `https://api.example.com/v1/sensors?apiKey=${sensitiveKey}&auth_token=${sensitiveToken}&lat=28.61&lng=77.21`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
        authorization: `Bearer ${sensitiveToken}`,
      }),
      text: async () => JSON.stringify({ status: "ok", data: sensitiveBody }),
    });

    const Schema = z.object({
      status: z.string(),
      data: z.string(),
    });

    const result = await fetchJson(sensitiveUrl, {
      schema: Schema,
      fetchFn: mockFetch as unknown as typeof fetch,
      headers: {
        Authorization: `Bearer ${sensitiveToken}`,
      },
    });

    expect(result.ok).toBe(true);

    // Collect all output logged via console.log
    const allLogs = consoleLogSpy.mock.calls
      .map((call) => (typeof call[0] === "string" ? call[0] : JSON.stringify(call[0])))
      .join("\n");

    // Must never leak secrets or sensitive response payload
    expect(allLogs).not.toContain(sensitiveKey);
    expect(allLogs).not.toContain(sensitiveToken);
    expect(allLogs).not.toContain(sensitiveBody);

    // Host and sanitized path are logged safely
    expect(allLogs).toContain("api.example.com");
    expect(allLogs).toContain("/v1/sensors");

    consoleLogSpy.mockRestore();
  });
});
