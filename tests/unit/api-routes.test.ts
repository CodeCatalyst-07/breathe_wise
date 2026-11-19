import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AirQualityPort, GeocodingPort, LlmClient, WeatherPort } from "@/core";
import { AdviceResponseSchema, ok } from "@/core";
import { POST as adviceHandler } from "@/app/api/advice/route";
import { POST as askHandler } from "@/app/api/ask/route";
import { POST as explainHandler } from "@/app/api/explain/route";
import { GET as geocodeHandler } from "@/app/api/geocode/route";
import { GET as healthHandler } from "@/app/api/health/route";
import { POST as parseProfileHandler } from "@/app/api/parse-profile/route";
import { createPipeline } from "@/server/pipeline";
import { resetContainer, setContainerForTests } from "@/server/container";
import { getRateLimiter } from "@/server/http/rate-limit";
import { GOLDEN_SCENARIOS } from "./fixtures/profiles";

describe("API Route Handlers", () => {
  const fakeClock = { nowIso: () => "2026-11-19T10:00:00.000Z" };

  const mockAq: AirQualityPort = {
    getAirQuality: vi.fn().mockResolvedValue(
      ok({
        pm25: 110,
        category: "poor" as const,
        source: "openaq" as const,
        kind: "measured" as const,
        basis: "instantaneous" as const,
        observedAt: "2026-11-19T10:00:00Z",
        timezone: "Asia/Kolkata",
        reading: {
          pm25: 110,
          concentration: 110,
          category: "poor" as const,
          kind: "measured" as const,
          basis: "instantaneous" as const,
          labelKey: "aqi.category.poor",
          basisLabelKey: "aqi.basis.instantaneous",
          ordinal: 3,
        },
        hourlyForecast: [
          { timestamp: "2026-11-19T10:00:00.000Z", pm25: 110 },
          { timestamp: "2026-11-19T11:00:00.000Z", pm25: 95 },
        ],
      }),
    ),
  };

  const mockWeather: WeatherPort = {
    getWeather: vi.fn().mockResolvedValue(
      ok({
        temperatureC: 20,
        humidityPercent: 65,
        windSpeedMps: 2.5,
        recordedAt: "2026-11-19T10:00:00Z",
        timezone: "Asia/Kolkata",
      }),
    ),
  };

  const mockGeocoding: GeocodingPort = {
    searchLocation: vi.fn().mockResolvedValue(
      ok([
        {
          label: "Connaught Place, New Delhi",
          lat: 28.6315,
          lng: 77.2167,
          timezone: "Asia/Kolkata",
        },
      ]),
    ),
    reverseGeocode: vi.fn().mockResolvedValue(
      ok({
        label: "Connaught Place, New Delhi",
        lat: 28.6315,
        lng: 77.2167,
      }),
    ),
  };

  const mockLlm: LlmClient = {
    generateExplanation: vi.fn().mockResolvedValue(
      ok({
        narrative: "Air quality requires precautions.",
        actionCommentaries: [],
        language: "en" as const,
        modelUsed: "gemma-4-31b-it",
      }),
    ),
    answer: vi
      .fn()
      .mockResolvedValue(ok("Ventilate between 11:00 and 12:00 when ambient air is cleanest.")),
    parseProfile: vi.fn().mockResolvedValue(
      ok({
        commuteMode: "metro",
        windowsHabit: "closed_all_day",
        hasElderly: true,
      }),
    ),
  };

  beforeEach(() => {
    getRateLimiter().reset();
    const pipeline = createPipeline({
      airQuality: mockAq,
      weather: mockWeather,
      geocoding: mockGeocoding,
      llm: mockLlm,
      clock: fakeClock,
    });

    setContainerForTests({
      pipeline,
      geocoding: mockGeocoding,
      llm: mockLlm,
    });
  });

  afterEach(() => {
    resetContainer();
    vi.clearAllMocks();
  });

  describe("GET /api/health", () => {
    it("returns minimal { status: 'ok' } without environment leakage", async () => {
      const req = new Request("http://localhost:3000/api/health", { method: "GET" });
      const res = await healthHandler(req);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json).toEqual({ status: "ok" });
      expect(res.headers.get("X-Request-Id")).toBeDefined();
    });
  });

  describe("POST /api/advice", () => {
    it("returns 200 AdviceResponse for valid profile", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: scenario.profile }),
      });

      const res = await adviceHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      const parseResult = AdviceResponseSchema.safeParse(json);
      expect(parseResult.success).toBe(true);
    });

    it("conforms to AdviceResponseSchema for all 4 golden scenarios", async () => {
      for (const [key, scenario] of Object.entries(GOLDEN_SCENARIOS)) {
        const req = new Request("http://localhost:3000/api/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: scenario.profile }),
        });

        const res = await adviceHandler(req);
        expect(res.status, `Scenario ${key} failed`).toBe(200);

        const json = await res.json();
        const validated = AdviceResponseSchema.safeParse(json);
        expect(validated.success, `Scenario ${key} schema validation failed`).toBe(true);
      }
    });

    it("rejects unknown payload fields with 400 without echoing values", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: scenario.profile,
          maliciousField: "ATTACK_TOKEN_NEVER_ECHO",
        }),
      });

      const res = await adviceHandler(req);
      expect(res.status).toBe(400);

      const json = (await res.json()) as {
        error: { message: string; details?: Array<{ path: string }> };
      };
      expect(JSON.stringify(json)).not.toContain("ATTACK_TOKEN_NEVER_ECHO");
      expect(JSON.stringify(json)).toContain("maliciousField");
    });
  });

  describe("POST /api/explain", () => {
    it("returns 200 with AI explanation when LLM succeeds", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: scenario.profile }),
      });

      const res = await explainHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { explanation: { source: string } };
      expect(json.explanation.source).toBe("ai");
    });

    it("NEVER fails when LLM is unavailable: returns 200 with builtin source", async () => {
      // Re-configure container without LLM
      const pipeline = createPipeline({
        airQuality: mockAq,
        weather: mockWeather,
      });
      setContainerForTests({
        pipeline,
        geocoding: mockGeocoding,
        llm: undefined,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: scenario.profile }),
      });

      const res = await explainHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { explanation: { source: string } };
      expect(json.explanation.source).toBe("builtin");
    });
  });

  describe("POST /api/ask", () => {
    it("returns 200 with AI answer on safe in-scope questions", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: scenario.profile,
          question: "When should I open windows?",
        }),
      });

      const res = await askHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { answer: string; explanationSource: string };
      expect(json.explanationSource).toBe("ai");
      expect(json.answer).toContain("Ventilate");
    });

    it("returns 200 with AI answer on multi-turn chat with long prior assistant turns", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const longAssistantAnswer =
        "Based on your household profile and current outdoor air pollution, running an effective HEPA air purifier can significantly reduce PM2.5 levels in your living space by approximately 40% to 50%. Since severe smog inversion is underway, please keep all exterior doors and windows firmly sealed and ensure sensitive family members remain indoors.";
      expect(longAssistantAnswer.length).toBeGreaterThan(300);

      const req = new Request("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: scenario.profile,
          question: "what is AQI in my area ?",
          history: [
            { role: "user", text: "How effective is my air purifier right now?" },
            { role: "assistant", text: longAssistantAnswer },
          ],
        }),
      });

      const res = await askHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { answer: string; explanationSource: string };
      expect(json.explanationSource).toBe("ai");
      expect(json.answer).toBeDefined();
    });

    it("returns 503 assistant_unavailable when LLM client is missing", async () => {
      const pipeline = createPipeline({
        airQuality: mockAq,
        weather: mockWeather,
      });
      setContainerForTests({
        pipeline,
        geocoding: mockGeocoding,
        llm: undefined,
      });

      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: scenario.profile,
          question: "What is the AQI?",
        }),
      });

      const res = await askHandler(req);
      expect(res.status).toBe(503);

      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("assistant_unavailable");
    });

    it("strictly rejects client-supplied results with 400", async () => {
      const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;
      const req = new Request("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: scenario.profile,
          question: "What should I do?",
          results: [{ actionId: "fake_action", deltaLikely: 999 }],
        }),
      });

      const res = await askHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/parse-profile", () => {
    it("parses free text into draft HouseholdProfile and list of understood fields", async () => {
      const req = new Request("http://localhost:3000/api/parse-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "We commute by metro, keep windows closed all day, and have elderly parents living with us.",
          language: "en",
        }),
      });

      const res = await parseProfileHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        draftProfile: { commuteMode: string; household: { hasElderly: boolean } };
        understoodFields: string[];
      };

      expect(json.draftProfile.commuteMode).toBe("metro");
      expect(json.draftProfile.household.hasElderly).toBe(true);
      expect(json.understoodFields).toContain("commuteMode");
      expect(json.understoodFields).toContain("hasElderly");
    });
  });

  describe("GET /api/geocode", () => {
    it("resolves candidates for valid search query", async () => {
      const req = new Request("http://localhost:3000/api/geocode?q=Connaught", { method: "GET" });
      const res = await geocodeHandler(req);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { candidates: Array<{ label: string; lat: number }> };
      expect(json.candidates.length).toBe(1);
      expect(json.candidates[0]?.label).toContain("Connaught Place");
    });

    it("rejects short query with 400", async () => {
      const req = new Request("http://localhost:3000/api/geocode?q=a", { method: "GET" });
      const res = await geocodeHandler(req);

      expect(res.status).toBe(400);
    });
  });
});
