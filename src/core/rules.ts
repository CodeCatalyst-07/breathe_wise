import { RULES_BY_CATEGORY } from "./rules-table";
import type { AqiCategoryLevel, HouseholdProfile } from "./types";

export * from "./rules-table";

/**
 * Standard safety keys for general disclaimers and symptom guidance.
 * Invariant: Never provide diagnostic claims, medication prescriptions, or absolute "safe" guarantees.
 */
export const SAFETY_DISCLAIMER_KEY = "safety.disclaimer.general_guidance";
export const SAFETY_MEDICAL_KEY = "safety.medical.seek_help_for_symptoms";

/**
 * Action selected by the rules engine with policy priority and reason code.
 */
export interface SelectedRuleAction {
  readonly actionId: string;
  readonly priority: number;
  readonly reasonKey: string;
  readonly dataStatus: "available" | "unavailable";
}

/**
 * Selects prioritized candidate actions based on AQI category and household vulnerability.
 *
 * Invariants:
 * 1. Vulnerability Monotonicity: Presence of children, elderly, or respiratory conditions
 *    strictly raises or preserves priority (vulnerablePriority <= basePriority). Caution is never reduced.
 * 2. Conservative Safety Floor: When air quality data is unavailable, behaves conservatively
 *    by evaluating against at least the "poor" category and tagging dataStatus as "unavailable".
 *
 * @param profile - Household demographic and lifestyle profile.
 * @param aqiCategory - Current or forecasted ambient AQI category.
 * @param isDataAvailable - Whether real-time sensor/forecast readings exist.
 * @returns Ordered array of SelectedRuleAction objects.
 */
export function selectRuleActions(
  profile: HouseholdProfile,
  aqiCategory: AqiCategoryLevel,
  isDataAvailable = true,
): readonly SelectedRuleAction[] {
  const isVulnerable =
    profile.household.childrenAgeBands.length > 0 ||
    profile.household.hasElderly ||
    profile.household.hasRespiratoryCondition;

  // Apply safety floor: if data unavailable, treat as at least "poor"
  const effectiveCategory: AqiCategoryLevel = isDataAvailable
    ? aqiCategory
    : aqiCategory === "very_poor" || aqiCategory === "severe"
      ? aqiCategory
      : "poor";

  const entries = RULES_BY_CATEGORY[effectiveCategory] ?? RULES_BY_CATEGORY["poor"];
  const dataStatus: "available" | "unavailable" = isDataAvailable ? "available" : "unavailable";

  return entries
    .map((rule) => {
      const priority = isVulnerable ? rule.vulnerablePriority : rule.basePriority;
      const reasonKey = isVulnerable ? rule.vulnerableReasonKey : rule.baseReasonKey;

      return {
        actionId: rule.actionId,
        priority,
        reasonKey,
        dataStatus,
      };
    })
    .sort((a, b) => a.priority - b.priority);
}
