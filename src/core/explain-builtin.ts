import type { DayPlan } from "./dayplan";
import type { ForecastOutlook } from "./outlook";
import type { RankedAction } from "./ranking";
import type { AqiReading } from "./types";

export interface BuiltinActionExplanation {
  readonly actionId: string;
  readonly whatToDoKey: string;
  readonly whyItMattersKey: string;
  readonly assumptionsKeys: readonly string[];
  readonly params?: Record<string, string | number>;
}

export interface BuiltinExplanationResult {
  readonly summaryKey: string;
  readonly summaryParams?: Record<string, string | number>;
  readonly perAction: readonly BuiltinActionExplanation[];
}

/**
 * Maps an action ID to its structured i18n explanation keys.
 */
function getActionExplanationKeys(actionId: string): {
  whatToDoKey: string;
  whyItMattersKey: string;
} {
  return {
    whatToDoKey: `builtin_explanations.${actionId}.what_to_do`,
    whyItMattersKey: `builtin_explanations.${actionId}.why_it_matters`,
  };
}

/**
 * Builds structured, offline-first deterministic explanations for all ranked actions.
 *
 * Invariant (No LLM Required):
 * The app functions 100% reliably without external LLM inference.
 * All explanations use deterministic i18n translation keys and mathematical parameters.
 */
export function buildBuiltinExplanations(
  rankedActions: readonly RankedAction[],
  dayPlan: DayPlan,
  outlook: ForecastOutlook,
  aqiReading?: AqiReading,
): BuiltinExplanationResult {
  const category = aqiReading?.category ?? "moderate";
  const summaryKey = `builtin_explanations.summary.${category}`;

  const summaryParams: Record<string, string | number> = {
    category,
    pm25: aqiReading?.pm25 ?? 0,
    outlookTrend: outlook.status,
  };

  if (outlook.cleanestHour) {
    summaryParams["cleanestHour"] = outlook.cleanestHour.hourLocal;
    summaryParams["cleanestPm25"] = outlook.cleanestHour.pm25;
  }

  const perAction: BuiltinActionExplanation[] = rankedActions.map((item) => {
    const keys = getActionExplanationKeys(item.actionId);
    const imp = item.impactResult;

    const params: Record<string, string | number> = {
      actionId: item.actionId,
    };

    if (imp.deltaLikely !== undefined) {
      params["deltaLikely"] = imp.deltaLikely;
    }
    if (imp.deltaLow !== undefined) {
      params["deltaLow"] = imp.deltaLow;
    }
    if (imp.deltaHigh !== undefined) {
      params["deltaHigh"] = imp.deltaHigh;
    }
    if (imp.costInr !== undefined) {
      params["costInr"] = imp.costInr;
    }

    if (item.actionId === "ventilate_at_cleanest_hour" && dayPlan.bestVentilationWindow) {
      params["windowStart"] = dayPlan.bestVentilationWindow.startHourLocal;
      params["windowEnd"] = dayPlan.bestVentilationWindow.endHourLocal;
    }

    if (item.actionId === "shift_outdoor_activity_to_cleaner_hour" && dayPlan.bestOutdoorWindow) {
      params["windowStart"] = dayPlan.bestOutdoorWindow.startHourLocal;
      params["windowEnd"] = dayPlan.bestOutdoorWindow.endHourLocal;
    }

    return {
      actionId: item.actionId,
      whatToDoKey: keys.whatToDoKey,
      whyItMattersKey: keys.whyItMattersKey,
      assumptionsKeys: imp.assumptions,
      params,
    };
  });

  return {
    summaryKey,
    summaryParams,
    perAction,
  };
}
