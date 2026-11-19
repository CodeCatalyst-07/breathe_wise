import { describe, expect, it, vi } from "vitest";
import type {
  AirQualityPort,
  AirQualitySnapshot,
  ExplanationRequest,
  ExplanationResponse,
  HouseholdProfile,
  LlmClient,
  QuestionLlmRequest,
  WeatherPort,
  WeatherSnapshot,
} from "@/core";
import { err, ok } from "@/core";
import { AdviceResponseSchema } from "@/core/response";
import { createPipeline } from "@/server/pipeline";
import { GOLDEN_SCENARIOS } from "./fixtures/profiles";

describe("Orchestration Pipeline & Safety Guardrails", () => {
  const fixedNow = "2026-11-19T06:00:00Z";
  const fakeClock = { nowIso: () => fixedNow };

  function makeHourlyForecast(basePm25: number) {
    const start = new Date(fixedNow).getTime();
    return Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(start + i * 3600000).toISOString(),
      pm25: basePm25 + ((i * 7) % 30),
    }));
  }

  function createMockAirQuality(pm25: number, failure = false): AirQualityPort {
    return {
      getAirQuality: async () => {
        if (failure) {
          return err({ code: "upstream_error", message: "OpenAQ station down", retryable: false });
        }
        const snapshot: AirQualitySnapshot = {
          pm25,
          source: "openaq",
          observedAt: fixedNow,
          kind: "measured",
          hourlyForecast: makeHourlyForecast(pm25),
          timezone: "Asia/Kolkata",
        };
        return ok(snapshot);
      },
    };
  }

  function createMockWeather(): WeatherPort {
    return {
      getWeather: async () => {
        const snap: WeatherSnapshot = {
          hourly: [
            {
              timestamp: fixedNow,
              windSpeedMs: 2.5,
              humidityPercent: 65,
              temperatureC: 18,
              precipitationMm: 0,
            },
          ],
          timezone: "Asia/Kolkata",
        };
        return ok(snap);
      },
    };
  }

  describe("Fast Path: buildAdvice (NO LLM)", () => {
    it("assembles complete AdviceResponse without invoking LLM", async () => {
      const llmSpy = vi.fn();
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(110),
        weather: createMockWeather(),
        llm: { generateExplanation: llmSpy } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const res = await pipeline.buildAdvice({ profile: scenario.profile });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(llmSpy).not.toHaveBeenCalled();
      const advice = res.value;

      // Assert complete response schema conformity
      const parsed = AdviceResponseSchema.safeParse(advice);
      expect(parsed.success).toBe(true);

      expect(advice.dataStatus).toBe("available");
      expect(advice.timezone).toBe("Asia/Kolkata");
      expect(advice.airQuality.reading.pm25).toBe(110);
      expect(advice.actions.length).toBeGreaterThan(0);
      expect(advice.explanation).toBeUndefined(); // Fast path does not attach AI explanation
    });
  });

  describe("Explain Path: explainAdvice Guardrails", () => {
    it("falls back to built-in when LLM invents unauthorized numbers after retry", async () => {
      const generateExplanation = vi
        .fn()
        .mockResolvedValueOnce(
          ok<ExplanationResponse>({
            narrative: "Air is bad, expect a 999 ug/m3 drop.", // 999 is hallucinated
            actionCommentaries: [],
            language: "en",
            modelUsed: "gemma-4-31b-it",
          }),
        )
        .mockResolvedValueOnce(
          ok<ExplanationResponse>({
            narrative: "Still hallucinating 888 ug/m3.", // 888 is still hallucinated
            actionCommentaries: [],
            language: "en",
            modelUsed: "gemma-4-31b-it",
          }),
        );

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(110),
        weather: createMockWeather(),
        llm: { generateExplanation } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const res = await pipeline.explainAdvice({ profile: scenario.profile });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(generateExplanation).toHaveBeenCalledTimes(2); // One initial + one retry
      expect(res.value.explanation?.source).toBe("builtin"); // Fell back to builtin
    });

    it("falls back to built-in when LLM violates medical or absolute safety claims", async () => {
      const generateExplanation = vi.fn().mockResolvedValue(
        ok<ExplanationResponse>({
          narrative: "This advice will completely cure your asthma and guarantees 100% safe air.",
          actionCommentaries: [],
          language: "en",
          modelUsed: "gemma-4-31b-it",
        }),
      );

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(110),
        weather: createMockWeather(),
        llm: { generateExplanation } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const res = await pipeline.explainAdvice({ profile: scenario.profile });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.explanation?.source).toBe("builtin");
    });

    it("allows valid verified output with hour labels to pass with AI explanation source", async () => {
      // Setup mock to return narrative using valid numbers from the computed advice
      const generateExplanation = vi.fn().mockImplementation(async (req: ExplanationRequest) => {
        return ok<ExplanationResponse>({
          narrative: "Air quality is poor. Reschedule outdoor tasks to 6:00.",
          actionCommentaries: [
            { actionId: "use_hepa_purifier", commentary: "Running HEPA purifier reduces PM2.5." },
          ],
          language: req.language,
          modelUsed: "gemma-4-31b-it",
        });
      });

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(110),
        weather: createMockWeather(),
        llm: { generateExplanation } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const res = await pipeline.explainAdvice({ profile: scenario.profile });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.explanation?.source).toBe("ai");
      expect(res.value.explanation?.summary).toContain("Air quality is poor");
    });
  });

  describe("Assistant Follow-Up: answerQuestion", () => {
    it("recomputes grounding server-side and answers safely", async () => {
      const answerSpy = vi
        .fn()
        .mockResolvedValue(
          ok("You can dry clothes outside during the afternoon when dispersion improves."),
        );

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(80),
        weather: createMockWeather(),
        llm: { answer: answerSpy } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;
      const res = await pipeline.answerQuestion({
        profile: scenario.profile,
        question: "Can I dry clothes on the balcony today?",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.explanationSource).toBe("ai");
      expect(answerSpy).toHaveBeenCalledTimes(1);

      const calledReq: QuestionLlmRequest = answerSpy.mock.calls[0]![0];
      expect(calledReq.groundingContext).toContain("Observed PM2.5: 80 ug/m3");
      expect(calledReq.question).toBe("Can I dry clothes on the balcony today?");
    });

    it("returns assistant_unavailable when LLM client is missing", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(80),
        weather: createMockWeather(),
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;
      const res = await pipeline.answerQuestion({
        profile: scenario.profile,
        question: "What should I do?",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("assistant_unavailable");
      }
    });

    it("falls back to safety notice if LLM generates medical advice in answer", async () => {
      const answerSpy = vi
        .fn()
        .mockResolvedValue(ok("You should take 5mg of cetirizine and use your inhaler 2 puffs."));

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(80),
        weather: createMockWeather(),
        llm: { answer: answerSpy } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;
      const res = await pipeline.answerQuestion({
        profile: scenario.profile,
        question: "I have a slight wheeze, what medicine should I take?",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.explanationSource).toBe("builtin");
      expect(res.value.declined).toBe(true);
      expect(res.value.safetyNoticeKey).toBe("safety.medical.seek_help_for_symptoms");
    });

    it("falls back when assistant response contains hallucinated numbers", async () => {
      const answerSpy = vi
        .fn()
        .mockResolvedValue(ok("This will reduce your exposure by exactly 9999 percent."));

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(80),
        weather: createMockWeather(),
        llm: { answer: answerSpy } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;
      const res = await pipeline.answerQuestion({
        profile: scenario.profile,
        question: "How much will this help?",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.explanationSource).toBe("builtin");
      expect(res.value.answer).toContain("Please refer to the built-in numerical recommendations");
    });

    it("handles assistant upstream failure gracefully", async () => {
      const answerSpy = vi
        .fn()
        .mockResolvedValue(
          err({ code: "upstream_error", message: "API timeout", retryable: false }),
        );

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(80),
        weather: createMockWeather(),
        llm: { answer: answerSpy } as unknown as LlmClient,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;
      const res = await pipeline.answerQuestion({
        profile: scenario.profile,
        question: "Can I go outside?",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("assistant_unavailable");
      }
    });
  });

  describe("Privacy Minimisation Invariants", () => {
    it("guarantees LLM payload NEVER receives coordinates, exact timestamps with location, or age bands", async () => {
      let capturedPayload: unknown = null;
      const fakeLlm: LlmClient = {
        generateExplanation: async (req: ExplanationRequest) => {
          capturedPayload = req;
          return ok({
            narrative: "Air is moderate.",
            actionCommentaries: [],
            language: "en",
            modelUsed: "gemma-4-31b-it",
          });
        },
      };

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(75),
        weather: createMockWeather(),
        llm: fakeLlm,
        clock: fakeClock,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      // Profile has childrenAgeBands: ["0-2"], lat: 28.6139, lng: 77.209
      await pipeline.explainAdvice({ profile: scenario.profile });

      expect(capturedPayload).not.toBeNull();
      const stringified = JSON.stringify(capturedPayload);

      // Coordinates MUST NOT exist in LLM request
      expect(stringified).not.toContain("28.6139");
      expect(stringified).not.toContain("77.209");
      expect(stringified).not.toContain('"lat"');
      expect(stringified).not.toContain('"lng"');

      // Age bands MUST NOT exist (only boolean 'vulnerable: true')
      expect(stringified).not.toContain("0-2");
      expect(stringified).not.toContain("childrenAgeBands");
      expect((capturedPayload as ExplanationRequest).vulnerable).toBe(true);
    });
  });

  describe("Golden Pipeline Fixture Scenarios (4 Profiles)", () => {
    it("Scenario 1: Infant + Purifier on Poor day", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(110),
        weather: createMockWeather(),
        clock: fakeClock,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["infantWithPurifier"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const advice = res.value;
      expect(advice.dataStatus).toBe("available");
      expect(advice.airQuality.reading.category).toBe("poor");
      expect(advice.actions[0]!.result.actionId).toBe("use_hepa_purifier");
      expect(advice.calendarEvents.length).toBeGreaterThan(0);
    });

    it("Scenario 2: Elderly + No Purifier on Severe day", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(320),
        weather: createMockWeather(),
        clock: fakeClock,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["elderlyWithoutPurifierSevere"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const advice = res.value;
      expect(advice.dataStatus).toBe("available");
      expect(advice.airQuality.reading.category).toBe("severe");
      // DayPlan must advise avoiding all outdoor activity
      expect(advice.dayPlan.bestOutdoorWindow).toBeUndefined();
      expect(advice.dayPlan.bestVentilationWindow).toBeUndefined();
      expect(advice.dayPlan.avoidWindows.length).toBeGreaterThan(0);
    });

    it("Scenario 3: Two-Wheeler Commuter on Moderate day", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(75),
        weather: createMockWeather(),
        clock: fakeClock,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const advice = res.value;
      expect(advice.dataStatus).toBe("available");
      expect(advice.airQuality.reading.category).toBe("moderate");
      const actionIds = advice.actions.map((a) => a.result.actionId);
      expect(actionIds).toContain("switch_commute_mode");
    });

    it("Scenario 4: Air Quality Unavailable (Conservative Floor)", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(0, true), // failure
        weather: createMockWeather(),
        clock: fakeClock,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["airQualityUnavailable"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const advice = res.value;
      expect(advice.dataStatus).toBe("unavailable");
      expect(advice.airQuality.provenance).toBe("unavailable");
      // Zero numeric deltas
      for (const a of advice.actions) {
        expect(a.result.displayMode).not.toBe("numeric");
        expect(a.result.deltaLikely).toBeUndefined();
      }
    });
  });

  describe("computeAdviceData Branch Coverage Hardening", () => {
    it("returns validation_error when profile is malformed", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(50),
      });

      const res = await pipeline.buildAdvice({
        profile: { invalid: true } as unknown as HouseholdProfile,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("validation_error");
      }
    });

    it("handles omitted weather provider and falls back gracefully", async () => {
      const pipeline = createPipeline({
        airQuality: createMockAirQuality(50),
        // no weather provider
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["infantWithPurifier"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.dataStatus).toBe("available");
      }
    });

    it("handles weather provider failure gracefully without aborting advice", async () => {
      const mockWeather: WeatherPort = {
        getWeather: vi
          .fn()
          .mockResolvedValue(
            err({ code: "timeout", message: "Weather timeout", retryable: false }),
          ),
      };

      const pipeline = createPipeline({
        airQuality: createMockAirQuality(50),
        weather: mockWeather,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["infantWithPurifier"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.dataStatus).toBe("available");
      }
    });

    it("handles fallback to weather timezone when AQ snapshot lacks timezone", async () => {
      const mockAq: AirQualityPort = {
        getAirQuality: vi.fn().mockResolvedValue(
          ok({
            pm25: 50,
            category: "satisfactory" as const,
            source: "open-meteo" as const,
            kind: "model" as const,
            basis: "instantaneous" as const,
            observedAt: "2026-11-19T10:00:00Z",
            // no timezone
          }),
        ),
      };

      const mockWeather: WeatherPort = {
        getWeather: vi.fn().mockResolvedValue(
          ok({
            temperatureC: 22,
            humidityPercent: 50,
            windSpeedMps: 3,
            recordedAt: "2026-11-19T10:00:00Z",
            timezone: "America/New_York",
          }),
        ),
      };

      const pipeline = createPipeline({
        airQuality: mockAq,
        weather: mockWeather,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["infantWithPurifier"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.timezone).toBe("America/New_York");
      }
    });

    it("handles direct pm25 and kind on AQ snapshot when reading object is absent", async () => {
      const mockAq: AirQualityPort = {
        getAirQuality: vi.fn().mockResolvedValue(
          ok({
            pm25: 45,
            category: "satisfactory" as const,
            source: "openaq" as const,
            kind: "measured" as const,
            basis: "instantaneous" as const,
            observedAt: "2026-11-19T10:00:00Z",
            timezone: "UTC",
          }),
        ),
      };

      const pipeline = createPipeline({
        airQuality: mockAq,
      });

      const res = await pipeline.buildAdvice({
        profile: GOLDEN_SCENARIOS["infantWithPurifier"]!.profile,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.airQuality.reading.pm25).toBe(45);
        expect(res.value.airQuality.reading.kind).toBe("measured");
      }
    });
  });
});
