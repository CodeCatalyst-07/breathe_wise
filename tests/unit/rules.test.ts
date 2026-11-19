import { describe, expect, it } from "vitest";
import {
  RULES_BY_CATEGORY,
  SAFETY_DISCLAIMER_KEY,
  SAFETY_MEDICAL_KEY,
  selectRuleActions,
} from "@/core/rules";
import type { AqiCategoryLevel, HouseholdProfile } from "@/core/types";

describe("Policy Rules & Vulnerability Invariants", () => {
  const nonVulnerableProfile: HouseholdProfile = {
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
    language: "en",
  };

  const vulnerableProfile: HouseholdProfile = {
    ...nonVulnerableProfile,
    household: {
      childrenAgeBands: ["0-2"],
      hasElderly: true,
      hasRespiratoryCondition: true,
    },
  };

  const allCategories: readonly AqiCategoryLevel[] = [
    "good",
    "satisfactory",
    "moderate",
    "poor",
    "very_poor",
    "severe",
  ];

  it("exports safety constants for general guidance and medical escalation", () => {
    expect(SAFETY_DISCLAIMER_KEY).toBe("safety.disclaimer.general_guidance");
    expect(SAFETY_MEDICAL_KEY).toBe("safety.medical.seek_help_for_symptoms");
  });

  it("ensures rules exist for all 6 AQI category levels", () => {
    for (const cat of allCategories) {
      const rules = RULES_BY_CATEGORY[cat];
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
    }
  });

  describe("Vulnerability Monotonicity Property", () => {
    it("property: vulnerable priority is strictly <= base priority (higher or equal urgency)", () => {
      for (const cat of allCategories) {
        const rules = RULES_BY_CATEGORY[cat];
        for (const rule of rules) {
          expect(rule.vulnerablePriority).toBeLessThanOrEqual(rule.basePriority);
        }
      }
    });

    it("vulnerable households receive higher or equal priority for every action in selection", () => {
      for (const cat of allCategories) {
        const nonVulActions = selectRuleActions(nonVulnerableProfile, cat, true);
        const vulActions = selectRuleActions(vulnerableProfile, cat, true);

        const nonVulMap = new Map(nonVulActions.map((a) => [a.actionId, a.priority]));
        const vulMap = new Map(vulActions.map((a) => [a.actionId, a.priority]));

        for (const [actionId, basePri] of nonVulMap) {
          const vulPri = vulMap.get(actionId);
          if (vulPri !== undefined) {
            expect(vulPri).toBeLessThanOrEqual(basePri);
          }
        }
      }
    });
  });

  describe("Safety floor when air quality data is unavailable", () => {
    it("behave conservatively (treat as poor) and flags dataStatus as unavailable", () => {
      const actions = selectRuleActions(nonVulnerableProfile, "good", false);
      expect(actions.length).toBeGreaterThan(0);

      for (const act of actions) {
        expect(act.dataStatus).toBe("unavailable");
      }

      // Should have actions matching "poor" tier (e.g. keep_windows_closed_in_peak, use_hepa_purifier)
      const actionIds = actions.map((a) => a.actionId);
      expect(actionIds).toContain("keep_windows_closed_in_peak");
      expect(actionIds).toContain("use_hepa_purifier");
    });

    it("preserves higher severity if existing reading was already severe", () => {
      const actions = selectRuleActions(nonVulnerableProfile, "severe", false);
      for (const act of actions) {
        expect(act.dataStatus).toBe("unavailable");
      }
      expect(actions[0]!.priority).toBe(1);
    });
  });
});
