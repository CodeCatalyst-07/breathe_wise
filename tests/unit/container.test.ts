import { describe, expect, it } from "vitest";
import type { AirQualityPort, AirQualitySnapshot } from "@/core";
import { getPipeline, resetPipeline } from "@/server/container";
import { Pipeline } from "@/server/pipeline";

describe("Dependency Injection Container", () => {
  it("creates a singleton pipeline instance", () => {
    resetPipeline();
    const p1 = getPipeline();
    const p2 = getPipeline();
    expect(p1).toBeInstanceOf(Pipeline);
    expect(p1).toBe(p2);
  });

  it("supports injecting fake overrides for isolated testing", () => {
    resetPipeline();
    const mockAq: AirQualityPort = {
      getAirQuality: async () => ({
        ok: true as const,
        value: {} as unknown as AirQualitySnapshot,
      }),
    };
    const custom = getPipeline({ airQuality: mockAq });
    expect(custom).toBeInstanceOf(Pipeline);
  });
});
