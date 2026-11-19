import type { Result } from "./ports";
import { err, ok } from "./ports";
import type { DaySchedule, EnvironmentType, ScheduleSegment } from "./types";

/**
 * Structured validation or calculation error for daily exposure schedules.
 */
export interface ExposureError {
  readonly code:
    | "EMPTY_SCHEDULE"
    | "INVALID_HOURS"
    | "OVERLAPPING_SEGMENTS"
    | "NON_FINITE_INPUT"
    | "MISSING_HOURLY_DATA";
  readonly message: string;
}

/**
 * Result of time-weighted daily exposure analysis.
 */
export interface ExposureCalculationResult {
  /** Time-weighted average exposure in µg/m³ */
  readonly timeWeightedAverage: number;
  /** Total analyzed schedule duration in hours */
  readonly totalHours: number;
  /** Maximum hourly exposure encountered in the schedule */
  readonly peakExposure: number;
  /** Lowest hourly exposure encountered in the schedule */
  readonly minExposure: number;
  /** Exposure and duration breakdown partitioned by microenvironment */
  readonly breakdownByEnvironment: Record<
    EnvironmentType,
    {
      readonly hours: number;
      readonly averageExposure: number;
    }
  >;
  /** Key assumptions applied during exposure integration */
  readonly assumptions: readonly string[];
}

/**
 * Validates that schedule segments do not overlap and lie within the valid daily [0, 24] range.
 *
 * @param schedule - DaySchedule containing segments.
 * @returns Result with validated segments sorted by startHour, or ExposureError.
 */
export function validateSchedule(
  schedule: DaySchedule,
): Result<readonly ScheduleSegment[], ExposureError> {
  const { segments } = schedule;

  if (segments.length === 0) {
    return err({
      code: "EMPTY_SCHEDULE",
      message: "Daily schedule must contain at least one segment.",
    });
  }

  for (const seg of segments) {
    if (!Number.isFinite(seg.startHour) || !Number.isFinite(seg.endHour)) {
      return err({
        code: "NON_FINITE_INPUT",
        message: "Segment startHour and endHour must be finite numbers.",
      });
    }

    if (seg.startHour < 0 || seg.endHour > 24 || seg.startHour >= seg.endHour) {
      return err({
        code: "INVALID_HOURS",
        message: `Invalid segment interval [${seg.startHour}, ${seg.endHour}]. Must satisfy 0 <= start < end <= 24.`,
      });
    }
  }

  // Sort by start hour to verify interval exclusivity
  const sorted = [...segments].sort((a, b) => a.startHour - b.startHour);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    if (current.endHour > next.startHour) {
      return err({
        code: "OVERLAPPING_SEGMENTS",
        message: `Overlapping schedule segments detected between [${current.startHour}, ${current.endHour}] and [${next.startHour}, ${next.endHour}].`,
      });
    }
  }

  return ok(sorted);
}

/**
 * Calculates deterministic time-weighted average PM2.5 exposure across a daily schedule.
 *
 * Integration method:
 * Evaluates the fractional overlap between each segment [startHour, endHour] and each 1-hour interval [h, h+1].
 * For each microenvironment:
 * - "indoor": uses indoor concentration (constant or array)
 * - "outdoor": uses outdoor concentration for hour h
 * - "commute": evaluates at ambient outdoor concentration (Honesty Rule: no invented travel-mode multipliers)
 *
 * @param options - DaySchedule, hourly outdoor forecast (24 elements), and indoor concentration.
 * @returns Result with ExposureCalculationResult or ExposureError.
 */
export function calculateTimeWeightedExposure(options: {
  readonly schedule: DaySchedule;
  readonly hourlyOutdoorPm25: readonly number[];
  readonly indoorPm25: number | readonly number[];
}): Result<ExposureCalculationResult, ExposureError> {
  const { schedule, hourlyOutdoorPm25, indoorPm25 } = options;

  if (hourlyOutdoorPm25.length < 24) {
    return err({
      code: "MISSING_HOURLY_DATA",
      message: `Hourly outdoor forecast requires 24 hourly points, received: ${hourlyOutdoorPm25.length}`,
    });
  }

  for (let h = 0; h < 24; h++) {
    const val = hourlyOutdoorPm25[h]!;
    if (!Number.isFinite(val) || val < 0) {
      return err({
        code: "NON_FINITE_INPUT",
        message: `Hourly outdoor concentration at hour ${h} must be a non-negative finite number, received: ${val}`,
      });
    }
  }

  const validatedScheduleResult = validateSchedule(schedule);
  if (!validatedScheduleResult.ok) {
    return validatedScheduleResult;
  }
  const segments = validatedScheduleResult.value;

  const envAccumulators: Record<EnvironmentType, { weightedSum: number; hours: number }> = {
    indoor: { weightedSum: 0, hours: 0 },
    outdoor: { weightedSum: 0, hours: 0 },
    commute: { weightedSum: 0, hours: 0 },
  };

  let totalWeightedExposure = 0;
  let totalHours = 0;
  let peakExposure = Number.NEGATIVE_INFINITY;
  let minExposure = Number.POSITIVE_INFINITY;

  for (const seg of segments) {
    const duration = seg.endHour - seg.startHour;
    const startInt = Math.floor(seg.startHour);
    const endInt = Math.ceil(seg.endHour);

    let segWeightedExposure = 0;

    for (let h = startInt; h < endInt && h < 24; h++) {
      const overlapStart = Math.max(seg.startHour, h);
      const overlapEnd = Math.min(seg.endHour, h + 1);
      const overlap = overlapEnd - overlapStart;

      if (overlap <= 0) continue;

      let concAtHour = 0;
      if (seg.environment === "indoor") {
        concAtHour = Array.isArray(indoorPm25) ? (indoorPm25[h] ?? indoorPm25[0] ?? 0) : indoorPm25;
      } else if (seg.environment === "outdoor") {
        concAtHour = hourlyOutdoorPm25[h]!;
      } else {
        // Commute: default to ambient outdoor per Honesty Rule
        concAtHour = hourlyOutdoorPm25[h]!;
      }

      segWeightedExposure += concAtHour * overlap;
      peakExposure = Math.max(peakExposure, concAtHour);
      minExposure = Math.min(minExposure, concAtHour);
    }

    totalWeightedExposure += segWeightedExposure;
    totalHours += duration;

    envAccumulators[seg.environment].weightedSum += segWeightedExposure;
    envAccumulators[seg.environment].hours += duration;
  }

  const twa = totalHours > 0 ? totalWeightedExposure / totalHours : 0;

  const breakdown: Record<EnvironmentType, { hours: number; averageExposure: number }> = {
    indoor: {
      hours: Number(envAccumulators.indoor.hours.toFixed(2)),
      averageExposure:
        envAccumulators.indoor.hours > 0
          ? Number((envAccumulators.indoor.weightedSum / envAccumulators.indoor.hours).toFixed(2))
          : 0,
    },
    outdoor: {
      hours: Number(envAccumulators.outdoor.hours.toFixed(2)),
      averageExposure:
        envAccumulators.outdoor.hours > 0
          ? Number((envAccumulators.outdoor.weightedSum / envAccumulators.outdoor.hours).toFixed(2))
          : 0,
    },
    commute: {
      hours: Number(envAccumulators.commute.hours.toFixed(2)),
      averageExposure:
        envAccumulators.commute.hours > 0
          ? Number((envAccumulators.commute.weightedSum / envAccumulators.commute.hours).toFixed(2))
          : 0,
    },
  };

  return ok({
    timeWeightedAverage: Number(twa.toFixed(2)),
    totalHours: Number(totalHours.toFixed(2)),
    peakExposure: Number(peakExposure.toFixed(2)),
    minExposure: Number(minExposure.toFixed(2)),
    breakdownByEnvironment: breakdown,
    assumptions: [
      "exposure.commute_assumes_ambient_outdoor",
      "exposure.linear_hourly_microenvironment_integration",
    ],
  });
}
