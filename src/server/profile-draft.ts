import { HouseholdProfileSchema, type HouseholdProfile, type Language } from "@/core";
import { AppError } from "@/lib/errors";

export interface DraftProfileResult {
  draftProfile: HouseholdProfile;
  understoodFields: string[];
}

/**
 * Maps raw extracted parameters from LLM into a validated HouseholdProfile draft.
 */
export function buildDraftProfileFromExtracted(
  extracted: Record<string, unknown>,
  language?: Language,
): DraftProfileResult {
  const understoodFields = Object.keys(extracted).filter(
    (k) => extracted[k] !== undefined && extracted[k] !== null,
  );

  const draftRaw: HouseholdProfile = {
    location: {
      lat: 28.6139,
      lng: 77.209,
      label: "Delhi NCR (Default)",
      timezone: "Asia/Kolkata",
    },
    household: {
      childrenAgeBands: Array.isArray(extracted["childrenAgeBands"])
        ? (extracted["childrenAgeBands"] as HouseholdProfile["household"]["childrenAgeBands"])
        : [],
      hasElderly: Boolean(extracted["hasElderly"]),
      hasRespiratoryCondition: Boolean(extracted["hasRespiratoryCondition"]),
    },
    commuteMode: (extracted["commuteMode"] as HouseholdProfile["commuteMode"]) ?? "metro",
    home: {
      roomVolumeM3: typeof extracted["roomVolumeM3"] === "number" ? extracted["roomVolumeM3"] : 45,
      windowsHabit:
        (extracted["windowsHabit"] as HouseholdProfile["home"]["windowsHabit"]) ?? "closed_all_day",
      purifierCadrM3h:
        typeof extracted["purifierCadrM3h"] === "number" ? extracted["purifierCadrM3h"] : 0,
      cookingFuel: (extracted["cookingFuel"] as HouseholdProfile["home"]["cookingFuel"]) ?? "lpg",
    },
    budgetInr: typeof extracted["budgetInr"] === "number" ? extracted["budgetInr"] : undefined,
    language: language ?? "en",
  };

  const validated = HouseholdProfileSchema.safeParse(draftRaw);
  if (!validated.success) {
    throw new AppError({
      message: "Parsed draft profile failed schema validation",
      code: "parsing_error",
      userMessage: "Extracted profile parameters did not conform to schema.",
      httpStatus: 500,
    });
  }

  return {
    draftProfile: validated.data,
    understoodFields,
  };
}
