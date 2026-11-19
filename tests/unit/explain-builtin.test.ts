import { describe, expect, it } from "vitest";
import { ACTIONS } from "@/core/actions";
import type { DayPlan } from "@/core/dayplan";
import { buildBuiltinExplanations } from "@/core/explain-builtin";
import type { ForecastOutlook } from "@/core/outlook";
import type { RankedAction } from "@/core/ranking";
import type { AqiReading } from "@/core/types";

describe("Builtin Explanations Generator", () => {
  const dummyDayPlan: DayPlan = {
    dataStatus: "available",
    slots: [],
    bestVentilationWindow: {
      startLocalIso: "2026-11-19T06:00:00Z",
      endLocalIso: "2026-11-19T08:00:00Z",
      startHourLocal: 6,
      endHourLocal: 8,
      avgPm25: 45,
      durationHours: 2,
      labelKey: "vent",
      reasonKey: "vent",
    },
    avoidWindows: [],
  };

  const dummyOutlook: ForecastOutlook = {
    status: "improving",
    cleanestHour: { timestamp: "2026-11-19T06:00:00Z", hourLocal: 6, pm25: 40 },
    worstHour: { timestamp: "2026-11-19T18:00:00Z", hourLocal: 18, pm25: 220 },
    thresholdUsed: 15,
  };

  const dummyReading: AqiReading = {
    concentration: 180,
    pm25: 180,
    category: "poor",
    kind: "measured",
    basis: "instantaneous",
    labelKey: "aqi.category.poor",
    basisLabelKey: "aqi.basis.instantaneous",
    ordinal: 3,
  };

  it("builds deterministic explanations for all ranked actions", () => {
    const rankedActions: RankedAction[] = ACTIONS.slice(0, 3).map((a, idx) => ({
      actionId: a.id,
      rank: idx + 1,
      priority: 1,
      impactResult: {
        actionId: a.id,
        displayMode: "numeric",
        deltaLikely: 40,
        deltaLow: 30,
        deltaHigh: 50,
        assumptions: ["assumptions.air_exchange_closed"],
        sources: ["modeller assumption"],
        confidence: "low",
      },
      reasonKey: "reasons.poor_air_seal_residence",
    }));

    const result = buildBuiltinExplanations(
      rankedActions,
      dummyDayPlan,
      dummyOutlook,
      dummyReading,
    );

    expect(result.summaryKey).toBe("builtin_explanations.summary.poor");
    expect(result.summaryParams?.pm25).toBe(180);
    expect(result.summaryParams?.outlookTrend).toBe("improving");
    expect(result.summaryParams?.cleanestHour).toBe(6);

    expect(result.perAction).toHaveLength(3);
    for (const exp of result.perAction) {
      expect(exp.whatToDoKey).toContain("builtin_explanations.");
      expect(exp.whatToDoKey).toContain(".what_to_do");
      expect(exp.whyItMattersKey).toContain(".why_it_matters");
      expect(exp.assumptionsKeys).toContain("assumptions.air_exchange_closed");
    }
  });
});
