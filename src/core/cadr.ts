import { z } from "zod";

/**
 * Standard unit conversion (1 cfm = 1.69901 m3/h).
 * 1 ft³ = 0.028316846592 m³
 * 1 hr = 60 min
 * Factor = 0.028316846592 * 60 = 1.69901079552 m³/h per CFM
 *
 * Status: unit conversion (1 cfm = 1.69901 m3/h)
 */
export const CFM_TO_M3H_FACTOR = 1.69901;

/**
 * Plausibility bounds for residential room purifier CADR values (20 to 1500 m³/h).
 * Status: heuristic - not scientific
 */
export const MIN_REALISTIC_CADR_M3H = 20;
export const MAX_REALISTIC_CADR_M3H = 1500;

export const PurifierLabelResultSchema = z.object({
  cadrM3h: z.number().nullable(),
  rawCadr: z.number().nullable().optional(),
  unit: z.enum(["m3h", "cfm", "unknown"]),
  brand: z.string().optional(),
  model: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type PurifierLabelResult = z.infer<typeof PurifierLabelResultSchema>;

/**
 * Converts Clean Air Delivery Rate (CADR) in CFM to m³/h.
 */
export function cfmToM3h(cfm: number): number {
  if (cfm <= 0 || !Number.isFinite(cfm)) {
    return 0;
  }
  return Math.round(cfm * CFM_TO_M3H_FACTOR);
}

/**
 * Validates whether a CADR value falls within realistic residential room purifier boundaries.
 */
export function isRealisticCadrM3h(cadrM3h: number | null | undefined): boolean {
  if (cadrM3h === null || cadrM3h === undefined) return false;
  return cadrM3h >= MIN_REALISTIC_CADR_M3H && cadrM3h <= MAX_REALISTIC_CADR_M3H;
}
