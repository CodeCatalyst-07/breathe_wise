import { OUTLOOK_DIFF_THRESHOLD_UG_M3 } from "./heuristics";

export type OutlookTrend = "improving" | "worsening" | "stable" | "unavailable";

export interface HourlyExtreme {
  readonly timestamp: string;
  readonly hourLocal: number;
  readonly pm25: number;
}

export interface ForecastOutlook {
  readonly status: OutlookTrend;
  readonly cleanestHour?: HourlyExtreme;
  readonly worstHour?: HourlyExtreme;
  readonly next12hAvg?: number;
  readonly following12hAvg?: number;
  readonly difference?: number;
  readonly thresholdUsed: number;
}

function getLocalHour(isoTimestamp: string, timezone?: string): number {
  try {
    const d = new Date(isoTimestamp);
    return parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "UTC",
        hour: "numeric",
        hourCycle: "h23",
      }).format(d),
      10,
    );
  } catch {
    return new Date(isoTimestamp).getUTCHours();
  }
}

/**
 * Computes 24-hour directional outlook by comparing the next 12h average
 * against the following 12h forecast average.
 *
 * Invariant (Honesty Rule):
 * Uses the named heuristic constant OUTLOOK_DIFF_THRESHOLD_UG_M3 (15.0 µg/m³).
 * Does not invent scientific precision.
 *
 * @param hourlyForecast - Series of hourly PM2.5 forecast entries.
 * @param timezone - Optional IANA timezone for local hour resolution.
 * @returns ForecastOutlook summary.
 */
export function forecastOutlook(
  hourlyForecast: readonly { timestamp: string; pm25: number }[],
  timezone?: string,
): ForecastOutlook {
  if (!hourlyForecast || hourlyForecast.length < 12) {
    return {
      status: "unavailable",
      thresholdUsed: OUTLOOK_DIFF_THRESHOLD_UG_M3,
    };
  }

  const horizon = hourlyForecast.slice(0, 24);

  let cleanest: { timestamp: string; pm25: number } = horizon[0]!;
  let worst: { timestamp: string; pm25: number } = horizon[0]!;

  for (const slot of horizon) {
    if (slot.pm25 < cleanest.pm25) cleanest = slot;
    if (slot.pm25 > worst.pm25) worst = slot;
  }

  const first12 = horizon.slice(0, 12);
  const next12hAvg = Number(
    (first12.reduce((acc, s) => acc + s.pm25, 0) / first12.length).toFixed(1),
  );

  const secondPart = horizon.slice(12, 24);
  const following12hAvg =
    secondPart.length > 0
      ? Number((secondPart.reduce((acc, s) => acc + s.pm25, 0) / secondPart.length).toFixed(1))
      : next12hAvg;

  // Positive difference means pollution is dropping (improving air)
  const difference = Number((next12hAvg - following12hAvg).toFixed(1));

  let status: OutlookTrend = "stable";
  if (difference > OUTLOOK_DIFF_THRESHOLD_UG_M3) {
    status = "improving";
  } else if (difference < -OUTLOOK_DIFF_THRESHOLD_UG_M3) {
    status = "worsening";
  }

  return {
    status,
    cleanestHour: {
      timestamp: cleanest.timestamp,
      hourLocal: getLocalHour(cleanest.timestamp, timezone),
      pm25: cleanest.pm25,
    },
    worstHour: {
      timestamp: worst.timestamp,
      hourLocal: getLocalHour(worst.timestamp, timezone),
      pm25: worst.pm25,
    },
    next12hAvg,
    following12hAvg,
    difference,
    thresholdUsed: OUTLOOK_DIFF_THRESHOLD_UG_M3,
  };
}
