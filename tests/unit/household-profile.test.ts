import { describe, expect, it } from "vitest";
import { HouseholdProfileSchema } from "@/core/types";

describe("HouseholdProfileSchema", () => {
  const validProfile = {
    location: {
      lat: 28.6139,
      lng: 77.209,
      label: "Connaught Place, New Delhi",
    },
    household: {
      childrenAgeBands: ["0-2", "6-12"] as const,
      hasElderly: true,
      hasRespiratoryCondition: true,
    },
    commuteMode: "metro" as const,
    home: {
      roomVolumeM3: 65,
      windowsHabit: "closed_all_day" as const,
      purifierCadrM3h: 300,
      cookingFuel: "lpg" as const,
    },
    budgetInr: 2500,
    language: "hi" as const,
  };

  it("accepts a complete valid household profile", () => {
    const parsed = HouseholdProfileSchema.safeParse(validProfile);
    expect(parsed.success).toBe(true);
  });

  it("rejects latitude outside -90..90 and longitude outside -180..180", () => {
    const invalidLat = HouseholdProfileSchema.safeParse({
      ...validProfile,
      location: { ...validProfile.location, lat: 95 },
    });
    expect(invalidLat.success).toBe(false);

    const invalidLng = HouseholdProfileSchema.safeParse({
      ...validProfile,
      location: { ...validProfile.location, lng: 185 },
    });
    expect(invalidLng.success).toBe(false);
  });

  it("rejects negative room volumes or negative budgets", () => {
    const invalidVolume = HouseholdProfileSchema.safeParse({
      ...validProfile,
      home: { ...validProfile.home, roomVolumeM3: -10 },
    });
    expect(invalidVolume.success).toBe(false);

    const invalidBudget = HouseholdProfileSchema.safeParse({
      ...validProfile,
      budgetInr: -100,
    });
    expect(invalidBudget.success).toBe(false);
  });

  it("allows optional fields like roomVolumeM3 and budgetInr to be omitted", () => {
    const minimal = {
      location: {
        lat: 28.7041,
        lng: 77.1025,
        label: "Rohini, Delhi",
      },
      household: {
        childrenAgeBands: [],
        hasElderly: false,
        hasRespiratoryCondition: false,
      },
      commuteMode: "walk" as const,
      home: {
        windowsHabit: "ventilate_as_needed" as const,
        cookingFuel: "electric_induction" as const,
      },
      language: "en" as const,
    };

    const parsed = HouseholdProfileSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
  });
});
