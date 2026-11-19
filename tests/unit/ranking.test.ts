import { describe, expect, it } from "vitest";
import { rankActions } from "@/core/ranking";
import type { ActionWithRule } from "@/core/ranking";
import type { HouseholdProfile } from "@/core/types";

describe("Deterministic Action Ranking", () => {
  const profile: HouseholdProfile = {
    location: { lat: 28.6139, lng: 77.209, label: "Delhi" },
    household: {
      childrenAgeBands: [],
      hasElderly: false,
      hasRespiratoryCondition: false,
    },
    commuteMode: "car",
    home: {
      windowsHabit: "closed_all_day",
      cookingFuel: "electric_induction",
    },
    budgetInr: 5000,
    language: "en",
  };

  it("ranks strictly by policy priority first", () => {
    const items: ActionWithRule[] = [
      {
        rule: {
          actionId: "action_low_priority",
          priority: 5,
          reasonKey: "reasons.low",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_low_priority",
          displayMode: "numeric",
          baseline: 200,
          scenario: 50,
          deltaLow: 150,
          deltaLikely: 150, // Huge numeric delta, but lower priority
          deltaHigh: 150,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
      },
      {
        rule: {
          actionId: "action_urgent",
          priority: 1, // Higher urgency (lower number)
          reasonKey: "reasons.urgent",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_urgent",
          displayMode: "numeric",
          baseline: 200,
          scenario: 180,
          deltaLow: 20,
          deltaLikely: 20,
          deltaHigh: 20,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
      },
    ];

    const ranked = rankActions(items, profile);
    expect(ranked[0]!.actionId).toBe("action_urgent");
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[0]!.reasonKey).toBe("reasons.urgent");

    expect(ranked[1]!.actionId).toBe("action_low_priority");
    expect(ranked[1]!.rank).toBe(2);
  });

  it("breaks priority ties using numeric delta magnitude (descending)", () => {
    const items: ActionWithRule[] = [
      {
        rule: {
          actionId: "action_smaller_reduction",
          priority: 2,
          reasonKey: "reasons.moderate",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_smaller_reduction",
          displayMode: "numeric",
          baseline: 200,
          scenario: 160,
          deltaLow: 30,
          deltaLikely: 40,
          deltaHigh: 50,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
      },
      {
        rule: {
          actionId: "action_larger_reduction",
          priority: 2, // Same priority
          reasonKey: "reasons.moderate",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_larger_reduction",
          displayMode: "numeric",
          baseline: 200,
          scenario: 100,
          deltaLow: 90,
          deltaLikely: 100, // Higher deltaLikely
          deltaHigh: 110,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "high",
        },
      },
    ];

    const ranked = rankActions(items, profile);
    expect(ranked[0]!.actionId).toBe("action_larger_reduction");
    expect(ranked[1]!.actionId).toBe("action_smaller_reduction");
  });

  it("performs stable alphabetical tie-break when priority and delta are equal", () => {
    const items: ActionWithRule[] = [
      {
        rule: {
          actionId: "zebra_action",
          priority: 3,
          reasonKey: "reasons.same",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "zebra_action",
          displayMode: "directional",
          direction: "reduces",
          assumptions: [],
          sources: [],
          confidence: "medium",
        },
      },
      {
        rule: {
          actionId: "alpha_action",
          priority: 3,
          reasonKey: "reasons.same",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "alpha_action",
          displayMode: "directional",
          direction: "reduces",
          assumptions: [],
          sources: [],
          confidence: "medium",
        },
      },
    ];

    const ranked = rankActions(items, profile);
    expect(ranked[0]!.actionId).toBe("alpha_action");
    expect(ranked[1]!.actionId).toBe("zebra_action");
  });

  it("breaks ties with minutes required when priorities and deltas match", () => {
    const items: ActionWithRule[] = [
      {
        rule: {
          actionId: "action_slower",
          priority: 3,
          reasonKey: "reasons.same",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_slower",
          displayMode: "numeric",
          baseline: 100,
          scenario: 80,
          deltaLow: 20,
          deltaLikely: 20,
          deltaHigh: 20,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "medium",
          minutes: 30,
        },
      },
      {
        rule: {
          actionId: "action_faster",
          priority: 3,
          reasonKey: "reasons.same",
          dataStatus: "available",
        },
        impactResult: {
          actionId: "action_faster",
          displayMode: "numeric",
          baseline: 100,
          scenario: 80,
          deltaLow: 20,
          deltaLikely: 20,
          deltaHigh: 20,
          unit: "ug/m3",
          assumptions: [],
          sources: [],
          confidence: "medium",
          minutes: 5,
        },
      },
    ];

    const ranked = rankActions(items, profile);
    expect(ranked[0]!.actionId).toBe("action_faster");
    expect(ranked[1]!.actionId).toBe("action_slower");
  });
});
