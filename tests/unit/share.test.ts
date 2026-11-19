import { describe, expect, it } from "vitest";
import { buildShareSummary } from "@/core/share";
import type { AdviceResponse } from "@/core/response";

const mockAdvice: AdviceResponse = {
  requestId: "req-123",
  generatedAt: "2026-11-19T06:00:00.000Z",
  timezone: "Asia/Kolkata",
  location: {
    label: "Indirapuram, Ghaziabad",
    roundedLat: 28.64,
    roundedLng: 77.37,
  },
  dataStatus: "available",
  airQuality: {
    provenance: "openaq",
    attributions: ["OpenAQ"],
    reading: {
      pm25: 284,
      category: "very_poor",
      kind: "measured",
      basis: "instantaneous",
    },
  },
  outlook: {
    status: "worsening",
    thresholdUsed: 20,
    cleanestHour: {
      hourLocal: 15,
      timestamp: "2026-11-19T15:00:00.000Z",
      pm25: 180,
    },
  },
  dayPlan: {
    dataStatus: "available",
    bestOutdoorWindow: {
      startLocalIso: "2026-11-19T14:00:00.000Z",
      endLocalIso: "2026-11-19T16:00:00.000Z",
      startHourLocal: 14,
      endHourLocal: 16,
      avgPm25: 185,
      durationHours: 2,
      labelKey: "dayplan.windows.best_outdoor.label",
      reasonKey: "dayplan.windows.best_outdoor.reason",
    },
    avoidWindows: [],
    slots: [],
  },
  calendarEvents: [],
  actions: [
    {
      rank: 1,
      reasonKey: "reasons.very_poor_hepa_essential",
      group: "household",
      result: {
        actionId: "use_hepa_purifier",
        displayMode: "numeric",
        baseline: 280,
        scenario: 140,
        deltaLikely: 140,
        deltaLow: 90,
        deltaHigh: 180,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "high",
        assumptions: ["assumptions.purifier_owned_cadr"],
        sources: ["AHAM AC-1"],
      },
      builtinExplanation: {
        actionId: "use_hepa_purifier",
        whatToDoKey: "builtin_explanations.use_hepa_purifier.what_to_do",
        whyItMattersKey: "builtin_explanations.use_hepa_purifier.why_it_matters",
        assumptionsKeys: [],
      },
    },
    {
      rank: 2,
      reasonKey: "reasons.very_poor_respirator_essential",
      group: "household",
      result: {
        actionId: "wear_fitted_respirator",
        displayMode: "numeric",
        baseline: 284,
        scenario: 219,
        deltaLikely: 65,
        deltaLow: 40,
        deltaHigh: 85,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "medium",
        assumptions: ["assumptions.respirator_fit_is_critical_caveat"],
        sources: ["NIOSH N95"],
      },
      builtinExplanation: {
        actionId: "wear_fitted_respirator",
        whatToDoKey: "builtin_explanations.wear_fitted_respirator.what_to_do",
        whyItMattersKey: "builtin_explanations.wear_fitted_respirator.why_it_matters",
        assumptionsKeys: [],
      },
    },
    {
      rank: 3,
      reasonKey: "reasons.poor_air_seal_residence",
      group: "household",
      result: {
        actionId: "keep_windows_closed_in_peak",
        displayMode: "numeric",
        baseline: 280,
        scenario: 235,
        deltaLikely: 45,
        deltaLow: 25,
        deltaHigh: 60,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "high",
        assumptions: ["assumptions.air_exchange_closed"],
        sources: ["ASHRAE 62.2"],
      },
      builtinExplanation: {
        actionId: "keep_windows_closed_in_peak",
        whatToDoKey: "builtin_explanations.keep_windows_closed_in_peak.what_to_do",
        whyItMattersKey: "builtin_explanations.keep_windows_closed_in_peak.why_it_matters",
        assumptionsKeys: [],
      },
    },
  ],
  assumptions: [],
  safety: {
    disclaimerKey: "safety.disclaimer.general_guidance",
    medicalHelpKey: "safety.medical.seek_help_for_symptoms",
  },
};

describe("Pure Share Summary Generator", () => {
  it("generates an English summary within the 600 char limit", () => {
    const summary = buildShareSummary(mockAdvice, "en");

    expect(summary.length).toBeLessThanOrEqual(600);
    expect(summary).toContain("BreatheWise Plan: Indirapuram, Ghaziabad");
    expect(summary).toContain("Air: Very Poor (PM2.5: 284 µg/m³, measured by station)");
    expect(summary).toContain("Cleanest window: 14:00-16:00");
    expect(summary).toContain("• Run HEPA air purifier continuously");
    expect(summary).toContain(
      "These are estimates and general guidance; see the app for assumptions. Not medical advice.",
    );
  });

  it("generates a Hindi summary within the 600 char limit with authentic Devanagari copy", () => {
    const summary = buildShareSummary(mockAdvice, "hi");

    expect(summary.length).toBeLessThanOrEqual(600);
    expect(summary).toContain("ब्रीदवाइज दैनिक सलाह: Indirapuram, Ghaziabad");
    expect(summary).toContain("हवा: बहुत खराब (PM2.5: 284 µg/m³, सेंसर द्वारा मापा गया)");
    expect(summary).toContain("सबसे साफ समय: 14:00-16:00");
    expect(summary).toContain("• HEPA एयर प्यूरीफायर चलाएं");
    expect(summary).toContain(
      "ये अनुमान व सामान्य मार्गदर्शन हैं; मान्यताओं के लिए ऐप देखें। चिकित्सीय सलाह नहीं।",
    );
  });

  it("strictly protects privacy: contains zero coordinates or demographic markers", () => {
    const summary = buildShareSummary(mockAdvice, "en").toLowerCase();

    expect(summary).not.toContain("28.64");
    expect(summary).not.toContain("77.37");
    expect(summary).not.toContain("lat");
    expect(summary).not.toContain("lng");
    expect(summary).not.toContain("asthma");
    expect(summary).not.toContain("elderly");
    expect(summary).not.toContain("child");
  });

  it("falls back to cleanestHour when bestOutdoorWindow is undefined", () => {
    const adviceWithoutWindow: AdviceResponse = {
      ...mockAdvice,
      dayPlan: {
        ...mockAdvice.dayPlan,
        bestOutdoorWindow: undefined,
      },
    };

    const summary = buildShareSummary(adviceWithoutWindow, "en");
    expect(summary).toContain("Cleanest time: around 15:00");
  });
});
