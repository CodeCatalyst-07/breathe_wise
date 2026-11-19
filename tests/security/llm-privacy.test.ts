import { describe, expect, it, vi } from "vitest";
import type { AirQualityPort, ExplanationRequest, LlmClient, WeatherPort } from "@/core";
import { ok } from "@/core";
import { createPipeline } from "@/server/pipeline";
import { GOLDEN_SCENARIOS } from "../unit/fixtures/profiles";

describe("LLM Client Privacy Invariants", () => {
  it("captures exact request body and strictly asserts no coordinates, age bands, or free-text profile content", async () => {
    let capturedExplanationReq: ExplanationRequest | undefined;

    const mockLlm: LlmClient = {
      generateExplanation: vi.fn().mockImplementation((req: ExplanationRequest) => {
        capturedExplanationReq = req;
        return Promise.resolve(
          ok({
            narrative: "Air quality requires precautions.",
            actionCommentaries: [],
            language: "en" as const,
            modelUsed: "gemma-4-31b-it",
          }),
        );
      }),
    };

    const mockAq: AirQualityPort = {
      getAirQuality: vi.fn().mockResolvedValue(
        ok({
          pm25: 180,
          category: "very_poor" as const,
          source: "openaq" as const,
          kind: "measured" as const,
          basis: "instantaneous" as const,
          observedAt: "2026-11-19T10:00:00Z",
          timezone: "Asia/Kolkata",
          reading: {
            pm25: 180,
            concentration: 180,
            category: "very_poor" as const,
            kind: "measured" as const,
            basis: "instantaneous" as const,
            labelKey: "aqi.category.very_poor",
            basisLabelKey: "aqi.basis.instantaneous",
            ordinal: 4,
          },
        }),
      ),
    };

    const mockWeather: WeatherPort = {
      getWeather: vi.fn().mockResolvedValue(
        ok({
          temperatureC: 18,
          humidityPercent: 70,
          windSpeedMps: 2.1,
          recordedAt: "2026-11-19T10:00:00Z",
          timezone: "Asia/Kolkata",
        }),
      ),
    };

    const pipeline = createPipeline({
      airQuality: mockAq,
      weather: mockWeather,
      llm: mockLlm,
    });

    const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
    const lat = scenario.profile.location.lat;
    const lng = scenario.profile.location.lng;

    const res = await pipeline.explainAdvice({
      profile: scenario.profile,
    });

    expect(res.ok).toBe(true);
    expect(mockLlm.generateExplanation).toHaveBeenCalledTimes(1);
    expect(capturedExplanationReq).toBeDefined();

    const serialized = JSON.stringify(capturedExplanationReq);

    // 1. Assert NO latitude or longitude values appear in the LLM request
    expect(serialized).not.toContain(String(lat));
    expect(serialized).not.toContain(String(lng));
    expect(serialized).not.toContain("28.61");
    expect(serialized).not.toContain("77.20");

    // 2. Assert NO child age bands appear (e.g. "0-2", "3-5", "6-12", "13-18")
    expect(serialized).not.toContain("0-2");
    expect(serialized).not.toContain("3-5");
    expect(serialized).not.toContain("6-12");
    expect(serialized).not.toContain("13-18");
    expect(serialized).not.toContain("childrenAgeBands");

    // 3. Assert NO free-text profile attributes or medical diagnosis flags appear
    expect(serialized).not.toContain("hasRespiratoryCondition");
    expect(serialized).not.toContain("hasElderly");
    expect(serialized).not.toContain("asthma");
    expect(serialized).not.toContain("copd");

    // 4. Assert ONLY privacy-minimized context was included
    expect(capturedExplanationReq?.vulnerable).toBe(true);
    expect(capturedExplanationReq?.category).toBe("very_poor");
  });
});
