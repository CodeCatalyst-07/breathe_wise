import { describe, expect, it } from "vitest";
import { getActionById } from "@/core/actions";
import { getAqiCategory } from "@/core/aqi";
import { rankActions } from "@/core/ranking";
import type { ActionWithRule } from "@/core/ranking";
import { selectRuleActions } from "@/core/rules";
import { GOLDEN_SCENARIOS } from "./fixtures/profiles";

describe("Golden Scenarios (End-to-End Decision Pipeline)", () => {
  describe("Scenario 1: Infant Household with Owned HEPA Purifier", () => {
    const scenario = GOLDEN_SCENARIOS["infantWithPurifier"]!;

    it("evaluates pipeline: categorizes poor air, prioritizes HEPA filtration, verifies result shape", () => {
      const aqiRes = getAqiCategory(scenario.context.airQuality.pm25);
      expect(aqiRes.ok).toBe(true);
      if (!aqiRes.ok) return;
      expect(aqiRes.value.id).toBe("poor");

      const rules = selectRuleActions(scenario.profile, aqiRes.value.id, scenario.isDataAvailable);

      // Verify vulnerability priority boost
      const hepaRule = rules.find((r) => r.actionId === "use_hepa_purifier")!;
      expect(hepaRule.priority).toBe(1); // Boosted from base priority 4 to 1
      expect(hepaRule.reasonKey).toBe("reasons.vulnerable_hepa_protection");

      // Evaluate applicable actions
      const evaluated: ActionWithRule[] = [];
      for (const rule of rules) {
        const actionDef = getActionById(rule.actionId);
        if (actionDef && actionDef.appliesTo(scenario.profile, scenario.context)) {
          const evalRes = actionDef.evaluate(scenario.profile, scenario.context);
          if (evalRes.ok) {
            evaluated.push({ rule, impactResult: evalRes.value });
          }
        }
      }

      const ranked = rankActions(evaluated, scenario.profile);
      expect(ranked.length).toBeGreaterThan(0);

      // Priority 1 action should be top ranked
      expect(ranked[0]!.priority).toBe(1);
      expect(ranked[0]!.actionId).toBe("use_hepa_purifier");
      expect(ranked[0]!.impactResult.assumptions).toContain("assumptions.purifier_owned_cadr");
      expect(ranked[0]!.impactResult.deltaLikely).toBeGreaterThan(0);
    });
  });

  describe("Scenario 2: Elderly Household without Purifier on a Severe Smog Day", () => {
    const scenario = GOLDEN_SCENARIOS["elderlyWithoutPurifierSevere"]!;

    it("evaluates emergency smog response with recommended CADR evaluation", () => {
      const aqiRes = getAqiCategory(scenario.context.airQuality.pm25);
      expect(aqiRes.ok).toBe(true);
      if (!aqiRes.ok) return;
      expect(aqiRes.value.id).toBe("severe");

      const rules = selectRuleActions(scenario.profile, aqiRes.value.id, scenario.isDataAvailable);

      const evaluated: ActionWithRule[] = [];
      for (const rule of rules) {
        const actionDef = getActionById(rule.actionId);
        if (actionDef && actionDef.appliesTo(scenario.profile, scenario.context)) {
          const evalRes = actionDef.evaluate(scenario.profile, scenario.context);
          if (evalRes.ok) {
            evaluated.push({ rule, impactResult: evalRes.value });
          }
        }
      }

      const ranked = rankActions(evaluated, scenario.profile);
      expect(ranked[0]!.priority).toBe(1);

      // In severe smog, top actions must include window envelope sealing and purifier
      const topActionIds = ranked.slice(0, 3).map((r) => r.actionId);
      expect(topActionIds).toContain("keep_windows_closed_in_peak");
      expect(topActionIds).toContain("use_hepa_purifier");

      const purifierAction = ranked.find((r) => r.actionId === "use_hepa_purifier")!;
      expect(purifierAction.impactResult.assumptions).toContain(
        "assumptions.purifier_recommended_cadr",
      );
    });
  });

  describe("Scenario 3: Two-Wheeler Commuter on a Moderate Day", () => {
    const scenario = GOLDEN_SCENARIOS["twoWheelerCommuterModerate"]!;

    it("prioritizes transit switching and outdoor schedule shift", () => {
      const aqiRes = getAqiCategory(scenario.context.airQuality.pm25);
      expect(aqiRes.ok).toBe(true);
      if (!aqiRes.ok) return;
      expect(aqiRes.value.id).toBe("moderate");

      const rules = selectRuleActions(scenario.profile, aqiRes.value.id, scenario.isDataAvailable);

      const evaluated: ActionWithRule[] = [];
      for (const rule of rules) {
        const actionDef = getActionById(rule.actionId);
        if (actionDef && actionDef.appliesTo(scenario.profile, scenario.context)) {
          const evalRes = actionDef.evaluate(scenario.profile, scenario.context);
          if (evalRes.ok) {
            evaluated.push({ rule, impactResult: evalRes.value });
          }
        }
      }

      const ranked = rankActions(evaluated, scenario.profile);
      const actionIds = ranked.map((r) => r.actionId);
      expect(actionIds).toContain("switch_commute_mode");
      expect(actionIds).toContain("shift_outdoor_activity_to_cleaner_hour");

      const commuteAction = ranked.find((r) => r.actionId === "switch_commute_mode")!;
      expect(commuteAction.impactResult.displayMode).toBe("directional");
      expect(commuteAction.impactResult.direction).toBe("reduces");
    });
  });

  describe("Scenario 4: Air Quality Data Unavailable (Conservative Fallback)", () => {
    const scenario = GOLDEN_SCENARIOS["airQualityUnavailable"]!;

    it("engages safety floor: flags dataStatus unavailable, never produces invented numbers", () => {
      const rules = selectRuleActions(
        scenario.profile,
        "poor", // Treated as poor safety floor
        scenario.isDataAvailable,
      );

      for (const rule of rules) {
        expect(rule.dataStatus).toBe("unavailable");
      }

      // Evaluates directional and safety actions
      const evaluated: ActionWithRule[] = [];
      for (const rule of rules) {
        const actionDef = getActionById(rule.actionId);
        // If data is unavailable, only directional or myth-check actions are evaluated
        if (
          actionDef &&
          actionDef.displayMode !== "numeric" &&
          actionDef.appliesTo(scenario.profile, scenario.context)
        ) {
          const evalRes = actionDef.evaluate(scenario.profile, scenario.context);
          if (evalRes.ok) {
            evaluated.push({ rule, impactResult: evalRes.value });
          }
        }
      }

      const ranked = rankActions(evaluated, scenario.profile);
      expect(ranked.length).toBeGreaterThan(0);
      for (const item of ranked) {
        // Zero invented numbers when sensor data is unavailable
        expect(item.impactResult.displayMode).not.toBe("numeric");
        expect(item.impactResult.deltaLikely).toBeUndefined();
      }
    });
  });
});
