import type { SelectedRuleAction } from "./rules";
import type { HouseholdProfile, ImpactResult } from "./types";

/**
 * Ranked action output with explainable reasonKey and deterministic ordinal rank.
 */
export interface RankedAction {
  /** 1-based ordinal rank assigned by the decision engine */
  readonly rank: number;
  /** Action identifier */
  readonly actionId: string;
  /** Policy priority from the rules table (lower is higher urgency) */
  readonly priority: number;
  /** Internationalization key explaining why this action was prioritized */
  readonly reasonKey: string;
  /** Evaluated quantitative or directional impact */
  readonly impactResult: ImpactResult;
}

export interface ActionWithRule {
  readonly rule: SelectedRuleAction;
  readonly impactResult: ImpactResult;
}

/**
 * Deterministically ranks evaluated actions based on:
 * 1. Policy priority from rules table (lowest priority number = highest urgency).
 * 2. Numeric delta impact magnitude (larger deltaLikely ranks higher).
 * 3. User budget/cost consideration if supplied (lower costInr ranks higher).
 * 4. Stable tie-breaking via alphabetical actionId.
 *
 * @param items - Evaluated actions paired with their selected rule priorities.
 * @param profile - User demographic and home profile.
 * @returns Sorted array of RankedAction objects.
 */
export function rankActions(
  items: readonly ActionWithRule[],
  profile: HouseholdProfile,
): readonly RankedAction[] {
  const sorted = [...items].sort((a, b) => {
    // 1. Primary sort: Policy priority (e.g. priority 1 before priority 2)
    if (a.rule.priority !== b.rule.priority) {
      return a.rule.priority - b.rule.priority;
    }

    // 2. Secondary sort: Numeric impact magnitude (higher reduction first)
    const deltaA =
      a.impactResult.displayMode === "numeric" && a.impactResult.deltaLikely !== undefined
        ? a.impactResult.deltaLikely
        : Number.NEGATIVE_INFINITY;

    const deltaB =
      b.impactResult.displayMode === "numeric" && b.impactResult.deltaLikely !== undefined
        ? b.impactResult.deltaLikely
        : Number.NEGATIVE_INFINITY;

    if (deltaA !== deltaB) {
      return deltaB - deltaA; // Descending
    }

    // 3. Tertiary sort: User-provided cost constraints (if profile supplied budget)
    if (profile.budgetInr !== undefined) {
      const costA = a.impactResult.costInr ?? 0;
      const costB = b.impactResult.costInr ?? 0;
      if (costA !== costB) {
        return costA - costB; // Lower cost first
      }
    }

    // 4. Quaternary sort: User-provided minutes
    const minA = a.impactResult.minutes ?? 0;
    const minB = b.impactResult.minutes ?? 0;
    if (minA !== minB) {
      return minA - minB;
    }

    // 5. Stable deterministic tie-break: Alphabetical actionId
    return a.rule.actionId.localeCompare(b.rule.actionId);
  });

  return sorted.map((item, index) => ({
    rank: index + 1,
    actionId: item.rule.actionId,
    priority: item.rule.priority,
    reasonKey: item.rule.reasonKey,
    impactResult: item.impactResult,
  }));
}
