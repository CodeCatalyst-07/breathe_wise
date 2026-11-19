import { COEFFICIENTS } from "./coefficients";
import type { Result } from "./ports";
import { err, ok } from "./ports";
import type { AirQualityKind, AqiBasis, AqiCategoryLevel, AqiReading } from "./types";

/**
 * Standard WHO 24-hour PM2.5 guideline value in µg/m³.
 * Sourced: WHO global air quality guidelines 2021.
 */
export const WHO_PM25_24H_GUIDELINE = COEFFICIENTS["whoPm25Guideline24h"]?.likely ?? 15.0;

/**
 * Ordered definition of CPCB air quality bands for PM2.5 (µg/m³).
 * Continuous inclusive upper bounds are used: (min, max].
 */
export interface AqiBandDefinition {
  readonly id: AqiCategoryLevel;
  readonly minConc: number;
  readonly maxConc: number;
  readonly minAqi: number;
  readonly maxAqi: number;
  readonly labelKey: string;
  readonly ordinal: number;
}

export const CPCB_PM25_BANDS: readonly AqiBandDefinition[] = [
  {
    id: "good",
    minConc: 0,
    maxConc: 30,
    minAqi: 0,
    maxAqi: 50,
    labelKey: "aqi.category.good",
    ordinal: 0,
  },
  {
    id: "satisfactory",
    minConc: 30,
    maxConc: 60,
    minAqi: 51,
    maxAqi: 100,
    labelKey: "aqi.category.satisfactory",
    ordinal: 1,
  },
  {
    id: "moderate",
    minConc: 60,
    maxConc: 90,
    minAqi: 101,
    maxAqi: 200,
    labelKey: "aqi.category.moderate",
    ordinal: 2,
  },
  {
    id: "poor",
    minConc: 90,
    maxConc: 120,
    minAqi: 201,
    maxAqi: 300,
    labelKey: "aqi.category.poor",
    ordinal: 3,
  },
  {
    id: "very_poor",
    minConc: 120,
    maxConc: 250,
    minAqi: 301,
    maxAqi: 400,
    labelKey: "aqi.category.very_poor",
    ordinal: 4,
  },
  {
    id: "severe",
    minConc: 250,
    maxConc: COEFFICIENTS["aqiTopBandConcentration"]?.likely ?? 450,
    minAqi: 401,
    maxAqi: 500,
    labelKey: "aqi.category.severe",
    ordinal: 5,
  },
] as const;

/**
 * Structured validation or calculation error for AQI evaluations.
 */
export interface AqiError {
  readonly code: "NEGATIVE_CONCENTRATION" | "NON_FINITE_INPUT" | "INVALID_BAND";
  readonly message: string;
}

/**
 * Determines the CPCB air quality category descriptor for a given PM2.5 concentration.
 * Uses inclusive upper bounds on continuous concentrations:
 * <=30 Good, <=60 Satisfactory, <=90 Moderate, <=120 Poor, <=250 Very Poor, >250 Severe.
 *
 * @param pm25 - Particulate concentration in µg/m³.
 * @returns Result with AqiBandDefinition or AqiError.
 */
export function getAqiCategory(pm25: number): Result<AqiBandDefinition, AqiError> {
  if (!Number.isFinite(pm25)) {
    return err({
      code: "NON_FINITE_INPUT",
      message: `PM2.5 concentration must be a finite number, received: ${pm25}`,
    });
  }

  if (pm25 < 0) {
    return err({
      code: "NEGATIVE_CONCENTRATION",
      message: `PM2.5 concentration cannot be negative, received: ${pm25}`,
    });
  }

  if (pm25 <= 30) return ok(CPCB_PM25_BANDS[0]!);
  if (pm25 <= 60) return ok(CPCB_PM25_BANDS[1]!);
  if (pm25 <= 90) return ok(CPCB_PM25_BANDS[2]!);
  if (pm25 <= 120) return ok(CPCB_PM25_BANDS[3]!);
  if (pm25 <= 250) return ok(CPCB_PM25_BANDS[4]!);
  return ok(CPCB_PM25_BANDS[5]!);
}

/**
 * Calculates the linear interpolated AQI sub-index number (0 to 500) according to CPCB formulas.
 * Note on Top Band Assumption:
 * For concentrations >250 µg/m³, interpolation scales linearly up to the assumed ceiling
 * of 450 µg/m³ (capped at 500 AQI). Documented in coefficients.ts as an assumption.
 *
 * @param pm25 - Particulate concentration in µg/m³.
 * @returns Interpolated AQI number rounded to nearest integer (capped at 500).
 */
export function calculateAqiNumber(pm25: number): Result<number, AqiError> {
  const bandResult = getAqiCategory(pm25);
  if (!bandResult.ok) {
    return bandResult;
  }

  const band = bandResult.value;
  if (pm25 <= 0) {
    return ok(0);
  }

  if (band.id === "severe" && pm25 >= band.maxConc) {
    return ok(500);
  }

  const concRange = band.maxConc - band.minConc;
  const aqiRange = band.maxAqi - band.minAqi;

  if (concRange <= 0) {
    return ok(band.maxAqi);
  }

  const interpolated = band.minAqi + (aqiRange / concRange) * (pm25 - band.minConc);
  const rounded = Math.min(500, Math.round(interpolated));

  return ok(rounded);
}

/**
 * Calculates how many times a given PM2.5 concentration exceeds the WHO 24-hour guideline (15 µg/m³).
 *
 * @param pm25 - Particulate concentration in µg/m³.
 * @returns Multiplier over WHO safe limit (e.g. 150 µg/m³ -> 10.0x).
 */
export function getWhoExceedanceRatio(pm25: number): Result<number, AqiError> {
  if (!Number.isFinite(pm25)) {
    return err({
      code: "NON_FINITE_INPUT",
      message: `PM2.5 concentration must be finite, received: ${pm25}`,
    });
  }
  if (pm25 < 0) {
    return err({
      code: "NEGATIVE_CONCENTRATION",
      message: `PM2.5 concentration cannot be negative, received: ${pm25}`,
    });
  }
  const ratio = Number((pm25 / WHO_PM25_24H_GUIDELINE).toFixed(2));
  return ok(ratio);
}

/**
 * Fully categorizes a reading with provenance, temporal basis, and UI label keys.
 * Ensures instantaneous readings are never mispresented as 24-hour averages.
 *
 * @param options - Concentration, kind (measured vs model), and basis (instantaneous vs 24h-average).
 * @returns Result containing a complete AqiReading.
 */
export function categorizeReading(options: {
  readonly concentration: number;
  readonly kind: AirQualityKind;
  readonly basis: AqiBasis;
}): Result<AqiReading, AqiError> {
  const catResult = getAqiCategory(options.concentration);
  if (!catResult.ok) {
    return catResult;
  }
  const aqiNumResult = calculateAqiNumber(options.concentration);
  if (!aqiNumResult.ok) {
    return aqiNumResult;
  }

  const band = catResult.value;
  const basisLabelKey =
    options.basis === "instantaneous" ? "aqi.basis.instantaneous" : "aqi.basis.24h_average";

  return ok({
    concentration: options.concentration,
    category: band.id,
    aqiNumber: aqiNumResult.value,
    kind: options.kind,
    basis: options.basis,
    labelKey: band.labelKey,
    basisLabelKey,
    ordinal: band.ordinal,
  });
}
