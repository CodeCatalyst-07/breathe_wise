import { describe, expect, it, vi } from "vitest";
import { POST as adviceHandler } from "@/app/api/advice/route";
import { POST as askHandler } from "@/app/api/ask/route";
import { createPipeline } from "@/server/pipeline";
import { resetContainer, setContainerForTests } from "@/server/container";
import { logger } from "@/lib/logger";
import { ok } from "@/core";

describe("API Security and Log Hygiene Guardrails", () => {
  it("strictly enforces that structured logs contain NO profile data, coordinates, questions, or raw IPs", async () => {
    const sentinelLat = 28.98765;
    const sentinelLng = 77.54321;
    const sentinelQuestion = "SENTINEL_USER_QUESTION_CONFIDENTIAL_HEALTH_QUERY";
    const sentinelRawIp = "198.51.100.42";

    const logSpy = vi.spyOn(logger, "info");

    const pipeline = createPipeline({
      airQuality: {
        getAirQuality: vi.fn().mockResolvedValue(
          ok({
            pm25: 80,
            category: "moderate",
            source: "open-meteo",
            kind: "model",
            basis: "instantaneous",
            observedAt: "2026-11-19T10:00:00Z",
          }),
        ),
      },
    });

    setContainerForTests({
      pipeline,
      geocoding: {
        searchLocation: vi.fn().mockResolvedValue(ok([])),
        reverseGeocode: vi.fn().mockResolvedValue(ok({ lat: 28.61, lng: 77.21, label: "Default" })),
      },
    });

    const adviceReq = new Request("http://localhost:3000/api/advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": sentinelRawIp,
      },
      body: JSON.stringify({
        profile: {
          location: {
            lat: sentinelLat,
            lng: sentinelLng,
            label: "Confidential Sentinel Place",
          },
          household: {
            childrenAgeBands: ["0-2"],
            hasElderly: true,
            hasRespiratoryCondition: true,
          },
          commuteMode: "walk",
          home: {
            roomVolumeM3: 40,
            windowsHabit: "closed_all_day",
            purifierCadrM3h: 150,
            cookingFuel: "lpg",
          },
          budgetInr: 2000,
          language: "en",
        },
      }),
    });

    await adviceHandler(adviceReq);

    const askReq = new Request("http://localhost:3000/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": sentinelRawIp,
      },
      body: JSON.stringify({
        profile: {
          location: { lat: sentinelLat, lng: sentinelLng, label: "Confidential Sentinel Place" },
          household: { childrenAgeBands: [], hasElderly: false, hasRespiratoryCondition: false },
          commuteMode: "metro",
          home: { windowsHabit: "closed_all_day", cookingFuel: "lpg" },
          language: "en",
        },
        question: sentinelQuestion,
      }),
    });

    await askHandler(askReq);

    resetContainer();

    // Verify all logger calls
    expect(logSpy).toHaveBeenCalled();
    for (const call of logSpy.mock.calls) {
      const serialized = JSON.stringify(call);

      // Invariant 1: NEVER log coordinates
      expect(serialized).not.toContain(String(sentinelLat));
      expect(serialized).not.toContain(String(sentinelLng));

      // Invariant 2: NEVER log user questions or body text
      expect(serialized).not.toContain(sentinelQuestion);
      expect(serialized).not.toContain("Confidential Sentinel Place");

      // Invariant 3: NEVER log raw client IP addresses
      expect(serialized).not.toContain(sentinelRawIp);
    }

    logSpy.mockRestore();
  });

  it("verifies API responses contain no wildcard CORS or Access-Control-* headers", async () => {
    const req = new Request("http://localhost:3000/api/health", { method: "GET" });

    // Test with actual handler
    const { GET: healthHandler } = await import("@/app/api/health/route");
    const response = await healthHandler(req);

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-methods")).toBeNull();
    expect(response.headers.get("access-control-allow-headers")).toBeNull();
    expect(response.headers.get("x-request-id")).toBeDefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
