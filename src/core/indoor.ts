import { COEFFICIENTS } from "./coefficients";
import type { Result } from "./ports";
import { err, ok } from "./ports";

/** Error representing invalid physical dimensions or degenerate parameter inputs. */
export interface IndoorModelError {
  readonly code: "INVALID_VOLUME" | "NEGATIVE_VALUE" | "NON_FINITE_INPUT" | "ZERO_DENOMINATOR";
  readonly message: string;
}

/** Parameter inputs for steady-state single-compartment indoor mass-balance model. */
export interface IndoorModelInput {
  readonly outdoorPm25: number;
  readonly roomVolumeM3: number;
  readonly airExchangeRatePerHour: number;
  readonly penetrationFactor?: number;
  readonly depositionRatePerHour?: number;
  readonly purifierCadrM3h?: number;
  readonly runFraction?: number;
  readonly indoorSourceUgPerHour?: number;
}

/** Evaluated indoor concentration bounds (µg/m³). */
export interface IndoorConcentrationEstimate {
  readonly low: number;
  readonly likely: number;
  readonly high: number;
  readonly unit: "ug/m3";
}

/** Recommended CADR boundaries based on target air changes per hour (ACH). */
export interface PurifierSizingRecommendation {
  readonly roomVolumeM3: number;
  readonly minCadrM3h: number;
  readonly recommendedCadrM3h: number;
  readonly maxCadrM3h: number;
  readonly targetAch: {
    readonly low: number;
    readonly likely: number;
    readonly high: number;
  };
}

/**
 * Calculates steady-state indoor PM2.5 concentration:
 * Cin = (a * P * Cout + S / V) / (a + k + CADReff / V)
 */
function solveSteadyState(
  a: number,
  P: number,
  Cout: number,
  S: number,
  V: number,
  k: number,
  cadrEff: number,
): number {
  const denominator = a + k + cadrEff / V;
  if (denominator <= 0) return Number.NaN;
  return (a * P * Cout + S / V) / denominator;
}

/**
 * Evaluates the single-compartment indoor model across low, likely, and high parameter sets.
 * Guarantees low <= likely <= high concentration bounds.
 */
export function calculateIndoorConcentration(
  input: IndoorModelInput,
): Result<IndoorConcentrationEstimate, IndoorModelError> {
  const {
    outdoorPm25,
    roomVolumeM3,
    airExchangeRatePerHour,
    purifierCadrM3h = 0,
    runFraction = 1.0,
    indoorSourceUgPerHour = 0,
  } = input;

  if (
    !Number.isFinite(outdoorPm25) ||
    !Number.isFinite(roomVolumeM3) ||
    !Number.isFinite(airExchangeRatePerHour) ||
    !Number.isFinite(purifierCadrM3h) ||
    !Number.isFinite(runFraction) ||
    !Number.isFinite(indoorSourceUgPerHour)
  ) {
    return err({
      code: "NON_FINITE_INPUT",
      message: "All indoor model numerical inputs must be finite numbers.",
    });
  }

  if (roomVolumeM3 <= 0) {
    return err({
      code: "INVALID_VOLUME",
      message: `Room volume must be strictly positive, received: ${roomVolumeM3} m³`,
    });
  }

  if (
    outdoorPm25 < 0 ||
    airExchangeRatePerHour < 0 ||
    purifierCadrM3h < 0 ||
    runFraction < 0 ||
    indoorSourceUgPerHour < 0
  ) {
    return err({
      code: "NEGATIVE_VALUE",
      message: "Physical parameters cannot be negative.",
    });
  }

  const cadrEff = purifierCadrM3h * Math.min(1.0, runFraction);
  const pCoef = COEFFICIENTS["penetrationFactor"]!;
  const kCoef = COEFFICIENTS["depositionRate"]!;

  const pLow = input.penetrationFactor ?? pCoef.low ?? 0.7;
  const pLikely = input.penetrationFactor ?? pCoef.likely ?? 0.85;
  const pHigh = input.penetrationFactor ?? pCoef.high ?? 1.0;

  const kLow = input.depositionRatePerHour ?? kCoef.low ?? 0.1;
  const kLikely = input.depositionRatePerHour ?? kCoef.likely ?? 0.3;
  const kHigh = input.depositionRatePerHour ?? kCoef.high ?? 0.5;

  const concLow = solveSteadyState(
    airExchangeRatePerHour,
    pLow,
    outdoorPm25,
    indoorSourceUgPerHour,
    roomVolumeM3,
    kHigh,
    cadrEff,
  );
  const concLikely = solveSteadyState(
    airExchangeRatePerHour,
    pLikely,
    outdoorPm25,
    indoorSourceUgPerHour,
    roomVolumeM3,
    kLikely,
    cadrEff,
  );
  const concHigh = solveSteadyState(
    airExchangeRatePerHour,
    pHigh,
    outdoorPm25,
    indoorSourceUgPerHour,
    roomVolumeM3,
    kLow,
    cadrEff,
  );

  if (!Number.isFinite(concLow) || !Number.isFinite(concLikely) || !Number.isFinite(concHigh)) {
    return err({
      code: "ZERO_DENOMINATOR",
      message: "Removal rate (a + k + CADR/V) resulted in zero or non-finite output.",
    });
  }

  return ok({
    low: Number(Math.min(concLow, concLikely, concHigh).toFixed(2)),
    likely: Number(concLikely.toFixed(2)),
    high: Number(Math.max(concLow, concLikely, concHigh).toFixed(2)),
    unit: "ug/m3",
  });
}

/**
 * Recommends clean air delivery rate (CADR) for a given room volume from target ACH (4 to 5).
 */
export function recommendPurifierCadr(
  roomVolumeM3: number,
): Result<PurifierSizingRecommendation, IndoorModelError> {
  if (!Number.isFinite(roomVolumeM3)) {
    return err({
      code: "NON_FINITE_INPUT",
      message: `Room volume must be a finite number, received: ${roomVolumeM3}`,
    });
  }

  if (roomVolumeM3 <= 0) {
    return err({
      code: "INVALID_VOLUME",
      message: `Room volume must be strictly positive, received: ${roomVolumeM3} m³`,
    });
  }

  const ach = COEFFICIENTS["purifierTargetACH"]!;
  const lowAch = ach.low ?? 4.0;
  const likelyAch = ach.likely ?? 4.5;
  const highAch = ach.high ?? 5.0;

  return ok({
    roomVolumeM3,
    minCadrM3h: Math.round(roomVolumeM3 * lowAch),
    recommendedCadrM3h: Math.round(roomVolumeM3 * likelyAch),
    maxCadrM3h: Math.round(roomVolumeM3 * highAch),
    targetAch: { low: lowAch, likely: likelyAch, high: highAch },
  });
}
