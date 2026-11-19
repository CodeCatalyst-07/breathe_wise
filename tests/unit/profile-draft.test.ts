import { describe, expect, it } from "vitest";
import { buildDraftProfileFromExtracted } from "@/server/profile-draft";
import { AppError } from "@/lib/errors";

describe("profile-draft unit tests", () => {
  it("builds a valid HouseholdProfile draft from minimal empty extracted map", () => {
    const result = buildDraftProfileFromExtracted({}, "en");

    expect(result.understoodFields).toEqual([]);
    expect(result.draftProfile.location.label).toBe("Delhi NCR (Default)");
    expect(result.draftProfile.household.childrenAgeBands).toEqual([]);
    expect(result.draftProfile.household.hasElderly).toBe(false);
    expect(result.draftProfile.commuteMode).toBe("metro");
    expect(result.draftProfile.home.windowsHabit).toBe("closed_all_day");
    expect(result.draftProfile.home.roomVolumeM3).toBe(45);
    expect(result.draftProfile.language).toBe("en");
  });

  it("correctly maps recognized fields and filters understoodFields", () => {
    const extracted = {
      childrenAgeBands: ["0-2", "3-5"],
      hasElderly: true,
      hasRespiratoryCondition: true,
      commuteMode: "two_wheeler",
      roomVolumeM3: 60,
      windowsHabit: "afternoon_ventilate",
      purifierCadrM3h: 300,
      cookingFuel: "electric_induction",
      budgetInr: 5000,
    };

    const result = buildDraftProfileFromExtracted(extracted, "hi");

    expect(result.understoodFields).toHaveLength(9);
    expect(result.draftProfile.household.childrenAgeBands).toEqual(["0-2", "3-5"]);
    expect(result.draftProfile.household.hasElderly).toBe(true);
    expect(result.draftProfile.household.hasRespiratoryCondition).toBe(true);
    expect(result.draftProfile.commuteMode).toBe("two_wheeler");
    expect(result.draftProfile.home.roomVolumeM3).toBe(60);
    expect(result.draftProfile.home.windowsHabit).toBe("afternoon_ventilate");
    expect(result.draftProfile.home.purifierCadrM3h).toBe(300);
    expect(result.draftProfile.home.cookingFuel).toBe("electric_induction");
    expect(result.draftProfile.budgetInr).toBe(5000);
    expect(result.draftProfile.language).toBe("hi");
  });

  it("throws AppError parsing_error if an extracted field violates schema", () => {
    const invalidExtracted = {
      commuteMode: "helicopter_flight_invalid",
    };

    expect(() => buildDraftProfileFromExtracted(invalidExtracted)).toThrow(AppError);
    try {
      buildDraftProfileFromExtracted(invalidExtracted);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe("parsing_error");
      expect(appErr.httpStatus).toBe(500);
    }
  });
});
