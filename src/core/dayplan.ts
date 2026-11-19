import { getAqiCategory } from "./aqi";
import {
  DAY_PLAN_DAYTIME_END_HOUR,
  DAY_PLAN_DAYTIME_START_HOUR,
  DAY_PLAN_WINDOW_MAX_HOURS,
  DAY_PLAN_WINDOW_MIN_HOURS,
} from "./heuristics";
import type { AqiCategoryLevel, HouseholdProfile, WeatherSnapshot } from "./types";

/**
 * Recommendation tag for outdoor physical activity.
 * Status: policy - to be reviewed
 */
export type OutdoorActivityPolicy = "ok" | "limit" | "avoid";

export interface HourlySlot {
  readonly hourLocal: number;
  readonly timestamp: string;
  readonly pm25: number;
  readonly category: AqiCategoryLevel;
  readonly outdoorActivity: OutdoorActivityPolicy;
  readonly ventilationOk: boolean;
}

export interface TimeWindow {
  readonly startLocalIso: string;
  readonly endLocalIso: string;
  readonly startHourLocal: number;
  readonly endHourLocal: number;
  readonly avgPm25: number;
  readonly durationHours: number;
  readonly labelKey: string;
  readonly reasonKey: string;
}

export interface DayPlan {
  readonly dataStatus: "available" | "forecast_unavailable";
  readonly slots: readonly HourlySlot[];
  readonly bestOutdoorWindow?: TimeWindow;
  readonly bestVentilationWindow?: TimeWindow;
  readonly avoidWindows: readonly TimeWindow[];
}

export interface DayPlanInput {
  readonly now: string;
  readonly timezone: string;
  readonly hourlyForecast: readonly { timestamp: string; pm25: number }[];
  readonly weather?: WeatherSnapshot;
  readonly profile: HouseholdProfile;
  readonly indoorLikely?: number;
}

function evaluateOutdoorActivity(
  cat: AqiCategoryLevel,
  vulnerable: boolean,
): OutdoorActivityPolicy {
  if (cat === "good" || cat === "satisfactory") return "ok";
  if (cat === "moderate") return vulnerable ? "limit" : "ok";
  if (cat === "poor") return vulnerable ? "avoid" : "limit";
  return "avoid";
}

function getLocalHour(isoTimestamp: string, timezone: string): number {
  try {
    const d = new Date(isoTimestamp);
    return parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(d),
      10,
    );
  } catch {
    return new Date(isoTimestamp).getUTCHours();
  }
}

function findBestContiguousWindow(
  slots: readonly HourlySlot[],
  filter: (s: HourlySlot) => boolean,
  labelKey: string,
  reasonKey: string,
): TimeWindow | undefined {
  let bestCandidate: TimeWindow | undefined;

  for (let len = DAY_PLAN_WINDOW_MIN_HOURS; len <= DAY_PLAN_WINDOW_MAX_HOURS; len++) {
    for (let i = 0; i <= slots.length - len; i++) {
      const windowSlots = slots.slice(i, i + len);
      if (!windowSlots.every(filter)) continue;

      const avgPm25 = Number(
        (windowSlots.reduce((acc, s) => acc + s.pm25, 0) / windowSlots.length).toFixed(1),
      );
      const first = windowSlots[0]!;
      const last = windowSlots[windowSlots.length - 1]!;
      const isDaytime = windowSlots.every(
        (s) =>
          s.hourLocal >= DAY_PLAN_DAYTIME_START_HOUR && s.hourLocal < DAY_PLAN_DAYTIME_END_HOUR,
      );
      const candidate: TimeWindow = {
        startLocalIso: first.timestamp,
        endLocalIso: last.timestamp,
        startHourLocal: first.hourLocal,
        endHourLocal: (last.hourLocal + 1) % 24,
        avgPm25,
        durationHours: len,
        labelKey,
        reasonKey,
      };

      if (!bestCandidate) {
        bestCandidate = candidate;
        continue;
      }

      // Preference: lower avg PM2.5, then daytime preferred, then longer duration
      const pmDiff = candidate.avgPm25 - bestCandidate.avgPm25;
      const bestIsDaytime =
        bestCandidate.startHourLocal >= DAY_PLAN_DAYTIME_START_HOUR &&
        bestCandidate.startHourLocal < DAY_PLAN_DAYTIME_END_HOUR;
      const isBetter =
        pmDiff < -0.1 ||
        (Math.abs(pmDiff) <= 0.1 &&
          ((isDaytime && !bestIsDaytime) ||
            (isDaytime === bestIsDaytime &&
              candidate.durationHours > bestCandidate.durationHours)));
      if (isBetter) bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function makeAvoidWindow(group: HourlySlot[]): TimeWindow {
  const first = group[0]!;
  const last = group[group.length - 1]!;
  const avg = Number((group.reduce((a, s) => a + s.pm25, 0) / group.length).toFixed(1));
  return {
    startLocalIso: first.timestamp,
    endLocalIso: last.timestamp,
    startHourLocal: first.hourLocal,
    endHourLocal: (last.hourLocal + 1) % 24,
    avgPm25: avg,
    durationHours: group.length,
    labelKey: "dayplan.windows.avoid.label",
    reasonKey: "dayplan.windows.avoid.reason",
  };
}

function findAvoidWindows(slots: readonly HourlySlot[]): TimeWindow[] {
  const result: TimeWindow[] = [];
  let current: HourlySlot[] = [];

  for (const slot of slots) {
    if (slot.outdoorActivity === "avoid") {
      current.push(slot);
    } else if (current.length > 0) {
      result.push(makeAvoidWindow(current));
      current = [];
    }
  }

  if (current.length > 0) {
    result.push(makeAvoidWindow(current));
  }

  return result;
}

/**
 * Plans hourly routine advice for the next 24 hours based on forecast air quality.
 *
 * Invariants:
 * - Never suggests outdoor activity or ventilation on Very Poor/Severe air.
 * - Ventilation allowed ONLY when outdoor PM2.5 < indoor likely estimate.
 * - Empty forecast falls back to conservative plan with dataStatus 'forecast_unavailable'.
 */
export function planDay(input: DayPlanInput): DayPlan {
  const { now, timezone, hourlyForecast, profile, indoorLikely } = input;

  if (!hourlyForecast || hourlyForecast.length === 0) {
    return { dataStatus: "forecast_unavailable", slots: [], avoidWindows: [] };
  }

  const isVulnerable =
    profile.household.childrenAgeBands.length > 0 ||
    profile.household.hasElderly ||
    profile.household.hasRespiratoryCondition;

  const nowEpoch = new Date(now).getTime();
  const sorted = [...hourlyForecast]
    .filter((f) => new Date(f.timestamp).getTime() >= nowEpoch)
    .slice(0, 24);

  // If filtered slots are empty or < 1, take first 24
  const sourceSlots = sorted.length > 0 ? sorted : hourlyForecast.slice(0, 24);

  const slots: HourlySlot[] = sourceSlots.map((item) => {
    const catResult = getAqiCategory(item.pm25);
    const category = catResult.ok ? catResult.value.id : "severe";
    const hourLocal = getLocalHour(item.timestamp, timezone);
    const outdoorActivity = evaluateOutdoorActivity(category, isVulnerable);

    // Natural ventilation rule:
    // Outdoor PM2.5 must be strictly lower than indoor likely concentration,
    // AND outdoor category cannot be Very Poor or Severe (airing in smog worsens indoor air).
    const ventilationOk =
      indoorLikely !== undefined &&
      item.pm25 < indoorLikely &&
      category !== "very_poor" &&
      category !== "severe";

    return {
      hourLocal,
      timestamp: item.timestamp,
      pm25: item.pm25,
      category,
      outdoorActivity,
      ventilationOk,
    };
  });

  const bestOutdoor = findBestContiguousWindow(
    slots,
    (s) => s.outdoorActivity !== "avoid",
    "dayplan.windows.best_outdoor.label",
    "dayplan.windows.best_outdoor.reason",
  );

  const bestVentilation = findBestContiguousWindow(
    slots,
    (s) => s.ventilationOk,
    "dayplan.windows.best_ventilation.label",
    "dayplan.windows.best_ventilation.reason",
  );

  const avoidWindows = findAvoidWindows(slots);

  return {
    dataStatus: "available",
    slots,
    bestOutdoorWindow: bestOutdoor,
    bestVentilationWindow: bestVentilation,
    avoidWindows,
  };
}
