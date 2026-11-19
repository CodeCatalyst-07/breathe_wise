import { COEFFICIENTS } from "./coefficients";
import type { Result } from "./ports";
import { err, ok } from "./ports";
import type { AirQualitySnapshot, HouseholdProfile, ImpactResult, WeatherSnapshot } from "./types";

export type ActionErrorCode =
  "DATA_UNAVAILABLE" | "INSUFFICIENT_FORECAST" | "CALCULATION_FAILURE" | "INAPPLICABLE";

export interface ActionError {
  readonly code: ActionErrorCode;
  readonly message: string;
}

export interface ActionContext {
  readonly airQuality: AirQualitySnapshot;
  readonly weather?: WeatherSnapshot;
  readonly nowIso?: string;
}

export function getRoomVolumeInfo(profile: HouseholdProfile): {
  volume: number;
  isDefault: boolean;
} {
  if (profile.home.roomVolumeM3 !== undefined && profile.home.roomVolumeM3 > 0) {
    return { volume: profile.home.roomVolumeM3, isDefault: false };
  }
  return { volume: COEFFICIENTS["defaultRoomVolumeM3"]?.likely ?? 45.0, isDefault: true };
}

export function extractHourly(context: ActionContext): readonly number[] {
  if (context.airQuality.hourlyForecast.length > 0) {
    return context.airQuality.hourlyForecast.map((p) => p.pm25);
  }
  return [context.airQuality.pm25];
}

function steadyState(a: number, P: number, Cout: number, k: number, cadr = 0, V = 1): number {
  const denom = a + k + cadr / V;
  return denom <= 0 ? 0 : (a * P * Cout) / denom;
}

export function evaluateVentilateAtCleanestHour(
  profile: HouseholdProfile,
  context: ActionContext,
): Result<ImpactResult, ActionError> {
  const hourly = extractHourly(context);
  if (hourly.length === 0) {
    return err({ code: "DATA_UNAVAILABLE", message: "Forecast points required" });
  }
  const cClean = Math.min(...hourly);
  const cDirty = Math.max(...hourly);
  const { isDefault } = getRoomVolumeInfo(profile);

  const aOpen = COEFFICIENTS["airExchangeOpen"]!;
  const pCoef = COEFFICIENTS["penetrationFactor"]!;
  const kCoef = COEFFICIENTS["depositionRate"]!;

  const aVals = [aOpen.low!, aOpen.likely!, aOpen.high!];
  const pVals = [pCoef.low!, pCoef.likely!, pCoef.high!];
  const kVals = [kCoef.low!, kCoef.likely!, kCoef.high!];

  const deltas: number[] = [];
  for (const a of aVals) {
    for (const P of pVals) {
      for (const k of kVals) {
        const dirty = steadyState(a, P, cDirty, k);
        const clean = steadyState(a, P, cClean, k);
        deltas.push(Math.max(0, dirty - clean));
      }
    }
  }

  const baseline = steadyState(aOpen.likely!, pCoef.likely!, cDirty, kCoef.likely!);
  const scenario = steadyState(aOpen.likely!, pCoef.likely!, cClean, kCoef.likely!);
  const dLikely = Math.max(0, baseline - scenario);

  const assumptions = ["assumptions.air_exchange_open", "assumptions.cleanest_vs_dirtiest_hour"];
  if (isDefault) assumptions.push("assumptions.default_room_volume");

  return ok({
    actionId: "ventilate_at_cleanest_hour",
    displayMode: "numeric",
    baseline: Number(baseline.toFixed(1)),
    scenario: Number(scenario.toFixed(1)),
    deltaLow: Number(Math.min(...deltas).toFixed(1)),
    deltaLikely: Number(dLikely.toFixed(1)),
    deltaHigh: Number(Math.max(...deltas).toFixed(1)),
    unit: "ug/m3 PM2.5",
    assumptions,
    sources: [aOpen.source],
    confidence: "medium",
  });
}

export function evaluateKeepWindowsClosed(
  profile: HouseholdProfile,
  context: ActionContext,
): Result<ImpactResult, ActionError> {
  const hourly = extractHourly(context);
  const peak = hourly.length > 0 ? Math.max(...hourly) : context.airQuality.pm25;
  const { isDefault } = getRoomVolumeInfo(profile);

  const aOpen = COEFFICIENTS["airExchangeOpen"]!;
  const aClosed = COEFFICIENTS["airExchangeClosed"]!;
  const pCoef = COEFFICIENTS["penetrationFactor"]!;
  const kCoef = COEFFICIENTS["depositionRate"]!;

  const aOpenVals = [aOpen.low!, aOpen.likely!, aOpen.high!];
  const aClosedVals = [aClosed.low!, aClosed.likely!, aClosed.high!];
  const pVals = [pCoef.low!, pCoef.likely!, pCoef.high!];
  const kVals = [kCoef.low!, kCoef.likely!, kCoef.high!];

  const deltas: number[] = [];
  for (const ao of aOpenVals) {
    for (const ac of aClosedVals) {
      for (const P of pVals) {
        for (const k of kVals) {
          const openConc = steadyState(ao, P, peak, k);
          const closedConc = steadyState(ac, P, peak, k);
          deltas.push(Math.max(0, openConc - closedConc));
        }
      }
    }
  }

  const baseline = steadyState(aOpen.likely!, pCoef.likely!, peak, kCoef.likely!);
  const scenario = steadyState(aClosed.likely!, pCoef.likely!, peak, kCoef.likely!);
  const dLikely = Math.max(0, baseline - scenario);

  const assumptions = ["assumptions.air_exchange_open", "assumptions.air_exchange_closed"];
  if (isDefault) assumptions.push("assumptions.default_room_volume");

  return ok({
    actionId: "keep_windows_closed_in_peak",
    displayMode: "numeric",
    baseline: Number(baseline.toFixed(1)),
    scenario: Number(scenario.toFixed(1)),
    deltaLow: Number(Math.min(...deltas).toFixed(1)),
    deltaLikely: Number(dLikely.toFixed(1)),
    deltaHigh: Number(Math.max(...deltas).toFixed(1)),
    unit: "ug/m3 PM2.5",
    assumptions,
    sources: [aClosed.source],
    confidence: "medium",
  });
}

export function evaluateHepaPurifier(
  profile: HouseholdProfile,
  context: ActionContext,
): Result<ImpactResult, ActionError> {
  const { volume: V, isDefault } = getRoomVolumeInfo(profile);
  const aClosed = COEFFICIENTS["airExchangeClosed"]!;
  const pCoef = COEFFICIENTS["penetrationFactor"]!;
  const kCoef = COEFFICIENTS["depositionRate"]!;
  const achTarget = COEFFICIENTS["purifierTargetACH"]!;

  const userCadr = profile.home.purifierCadrM3h;
  const isRecommended = !userCadr || userCadr <= 0;

  const cadrVals = isRecommended
    ? [V * achTarget.low!, V * achTarget.likely!, V * achTarget.high!]
    : [userCadr!];

  const aClosedVals = [aClosed.low!, aClosed.likely!, aClosed.high!];
  const pVals = [pCoef.low!, pCoef.likely!, pCoef.high!];
  const kVals = [kCoef.low!, kCoef.likely!, kCoef.high!];
  const cout = context.airQuality.pm25;

  const deltas: number[] = [];
  for (const ac of aClosedVals) {
    for (const P of pVals) {
      for (const k of kVals) {
        for (const cadr of cadrVals) {
          const unpurified = steadyState(ac, P, cout, k, 0, V);
          const purified = steadyState(ac, P, cout, k, cadr, V);
          deltas.push(Math.max(0, unpurified - purified));
        }
      }
    }
  }

  const likelyCadr = isRecommended ? V * achTarget.likely! : userCadr!;
  const baseline = steadyState(aClosed.likely!, pCoef.likely!, cout, kCoef.likely!, 0, V);
  const scenario = steadyState(aClosed.likely!, pCoef.likely!, cout, kCoef.likely!, likelyCadr, V);
  const dLikely = Math.max(0, baseline - scenario);

  const assumptions = [
    isRecommended ? "assumptions.purifier_recommended_cadr" : "assumptions.purifier_owned_cadr",
    "assumptions.air_exchange_closed",
  ];
  if (isDefault) assumptions.push("assumptions.default_room_volume");

  return ok({
    actionId: "use_hepa_purifier",
    displayMode: "numeric",
    baseline: Number(baseline.toFixed(1)),
    scenario: Number(scenario.toFixed(1)),
    deltaLow: Number(Math.min(...deltas).toFixed(1)),
    deltaLikely: Number(dLikely.toFixed(1)),
    deltaHigh: Number(Math.max(...deltas).toFixed(1)),
    unit: "ug/m3 PM2.5",
    assumptions,
    sources: [achTarget.source],
    confidence: isRecommended ? "low" : "medium",
    costInr: profile.budgetInr,
  });
}

export function evaluateShiftOutdoorActivity(
  _profile: HouseholdProfile,
  context: ActionContext,
): Result<ImpactResult, ActionError> {
  const hourly = extractHourly(context);
  const cleanest = Math.min(...hourly);
  const peak = Math.max(...hourly);
  const diff = Number(Math.max(0, peak - cleanest).toFixed(1));

  return ok({
    actionId: "shift_outdoor_activity_to_cleaner_hour",
    displayMode: "numeric",
    baseline: Number(peak.toFixed(1)),
    scenario: Number(cleanest.toFixed(1)),
    deltaLow: diff,
    deltaLikely: diff,
    deltaHigh: diff,
    unit: "ug/m3 PM2.5",
    assumptions: ["assumptions.forecast_peak_vs_cleanest_outdoor"],
    sources: ["Hourly atmospheric forecast"],
    confidence: "high",
  });
}
