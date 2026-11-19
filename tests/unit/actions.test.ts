import { describe, expect, it } from "vitest";
import { ACTIONS, getActionById } from "@/core/actions";
import type { ActionContext } from "@/core/actions";
import type { HouseholdProfile } from "@/core/types";

describe("Action Catalogue Evaluation", () => {
  const baseProfile: HouseholdProfile = {
    location: { lat: 28.6139, lng: 77.209, label: "New Delhi" },
    household: {
      childrenAgeBands: ["0-2"],
      hasElderly: true,
      hasRespiratoryCondition: true,
    },
    commuteMode: "two_wheeler",
    home: {
      roomVolumeM3: 50,
      windowsHabit: "morning_ventilate",
      purifierCadrM3h: undefined, // no owned purifier
      cookingFuel: "lpg",
    },
    language: "en",
  };

  const hourlyForecast = [
    { timestamp: "2026-11-19T00:00:00Z", pm25: 180 },
    { timestamp: "2026-11-19T06:00:00Z", pm25: 280 }, // Peak / dirtiest
    { timestamp: "2026-11-19T14:00:00Z", pm25: 90 }, // Cleanest
    { timestamp: "2026-11-19T20:00:00Z", pm25: 220 },
  ];

  const context: ActionContext = {
    airQuality: {
      pm25: 200,
      source: "openaq",
      observedAt: "2026-11-19T08:00:00Z",
      kind: "measured",
      hourlyForecast,
    },
  };

  it("contains exactly 12 distinct actions", () => {
    expect(ACTIONS).toHaveLength(12);
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("evaluates ventilate_at_cleanest_hour with numeric delta and invariant deltaLow <= deltaLikely <= deltaHigh", () => {
    const action = getActionById("ventilate_at_cleanest_hour")!;
    expect(action).toBeDefined();
    expect(action.displayMode).toBe("numeric");

    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.displayMode).toBe("numeric");
      expect(imp.deltaLow!).toBeLessThanOrEqual(imp.deltaLikely!);
      expect(imp.deltaLikely!).toBeLessThanOrEqual(imp.deltaHigh!);
      expect(imp.deltaLikely!).toBeGreaterThan(0);
      expect(imp.costInr).toBeUndefined(); // User supplied no cost
    }
  });

  it("evaluates keep_windows_closed_in_peak with numeric delta", () => {
    const action = getActionById("keep_windows_closed_in_peak")!;
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.displayMode).toBe("numeric");
      expect(imp.deltaLow!).toBeLessThanOrEqual(imp.deltaLikely!);
      expect(imp.deltaLikely!).toBeLessThanOrEqual(imp.deltaHigh!);
      expect(imp.deltaLikely!).toBeGreaterThan(0);
    }
  });

  it("evaluates use_hepa_purifier with recommended CADR tag when profile has no CADR", () => {
    const action = getActionById("use_hepa_purifier")!;
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.displayMode).toBe("numeric");
      expect(imp.assumptions).toContain("assumptions.purifier_recommended_cadr");
      expect(imp.assumptions).not.toContain("assumptions.purifier_owned_cadr");
      expect(imp.deltaLow!).toBeLessThanOrEqual(imp.deltaLikely!);
      expect(imp.deltaLikely!).toBeLessThanOrEqual(imp.deltaHigh!);
    }
  });

  it("evaluates use_hepa_purifier with owned CADR tag and budget when user profile specifies them", () => {
    const profileWithPurifier: HouseholdProfile = {
      ...baseProfile,
      home: {
        ...baseProfile.home,
        purifierCadrM3h: 350,
      },
      budgetInr: 8000,
    };

    const action = getActionById("use_hepa_purifier")!;
    const result = action.evaluate(profileWithPurifier, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.assumptions).toContain("assumptions.purifier_owned_cadr");
      expect(imp.costInr).toBe(8000);
    }
  });

  it("evaluates shift_outdoor_activity_to_cleaner_hour with direct forecast comparison", () => {
    const action = getActionById("shift_outdoor_activity_to_cleaner_hour")!;
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.displayMode).toBe("numeric");
      // Peak 280, cleanest 90 -> diff = 190
      expect(imp.baseline).toBe(280);
      expect(imp.scenario).toBe(90);
      expect(imp.deltaLikely).toBe(190);
      expect(imp.deltaLow).toBe(190);
      expect(imp.deltaHigh).toBe(190);
    }
  });

  it("evaluates wear_fitted_respirator as directional only with no numeric delta", () => {
    const action = getActionById("wear_fitted_respirator")!;
    expect(action.displayMode).toBe("directional");

    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const imp = result.value;
      expect(imp.displayMode).toBe("directional");
      expect(imp.direction).toBe("reduces");
      expect(imp.deltaLikely).toBeUndefined();
      expect(imp.baseline).toBeUndefined();
    }
  });

  it("evaluates switch_commute_mode as directional only with no numeric delta", () => {
    const action = getActionById("switch_commute_mode")!;
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
      expect(result.value.deltaLikely).toBeUndefined();
    }
  });

  it("evaluates improve_cooking_ventilation as directional only with no numeric delta", () => {
    const action = getActionById("improve_cooking_ventilation")!;
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
    }
  });

  it("evaluates avoid_waste_and_biomass_burning as community directional action", () => {
    const action = getActionById("avoid_waste_and_biomass_burning")!;
    expect(action.group).toBe("community");
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
    }
  });

  it("evaluates shared_clean_air_room_for_building as community directional action", () => {
    const action = getActionById("shared_clean_air_room_for_building")!;
    expect(action.group).toBe("community");
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
      expect(result.value.assumptions).toContain("assumptions.shared_clean_air_room_envelope");
    }
  });

  it("evaluates reduce_vehicle_idling_at_school_gates as community directional action", () => {
    const action = getActionById("reduce_vehicle_idling_at_school_gates")!;
    expect(action.group).toBe("community");
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
      expect(result.value.assumptions).toContain("assumptions.school_gate_idling_exposure");
    }
  });

  it("evaluates organise_carpool_or_shared_transport as community directional action", () => {
    const action = getActionById("organise_carpool_or_shared_transport")!;
    expect(action.group).toBe("community");
    expect(action.displayMode).toBe("directional");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.direction).toBe("reduces");
      expect(result.value.assumptions).toContain("assumptions.carpooling_trip_curtailment");
    }
  });

  it("evaluates plants_myth_check as myth-check with ineffective direction", () => {
    const action = getActionById("plants_myth_check")!;
    expect(action.displayMode).toBe("myth-check");
    const result = action.evaluate(baseProfile, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.displayMode).toBe("myth-check");
      expect(result.value.direction).toBe("ineffective");
      expect(result.value.deltaLikely).toBeUndefined();
    }
  });

  describe("Brute-Force Corner Combinations & Default Room Volume", () => {
    function ss(a: number, P: number, Cout: number, k: number, cadr = 0, V = 1): number {
      return (a * P * Cout) / (a + k + cadr / V);
    }

    it("verifies ventilate_at_cleanest_hour deltaLow/High equal true min/max over all parameter corners", () => {
      const action = getActionById("ventilate_at_cleanest_hour")!;
      const result = action.evaluate(baseProfile, context);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const aVals = [1.5, 3.0, 6.0];
      const pVals = [0.7, 0.85, 1.0];
      const kVals = [0.1, 0.3, 0.5];
      const cDirty = 280;
      const cClean = 90;

      const corners: number[] = [];
      for (const a of aVals) {
        for (const P of pVals) {
          for (const k of kVals) {
            corners.push(Math.max(0, ss(a, P, cDirty, k) - ss(a, P, cClean, k)));
          }
        }
      }

      const expectedLow = Number(Math.min(...corners).toFixed(1));
      const expectedHigh = Number(Math.max(...corners).toFixed(1));

      expect(result.value.deltaLow).toBe(expectedLow);
      expect(result.value.deltaHigh).toBe(expectedHigh);
    });

    it("verifies keep_windows_closed_in_peak deltaLow/High equal true min/max over all parameter corners", () => {
      const action = getActionById("keep_windows_closed_in_peak")!;
      const result = action.evaluate(baseProfile, context);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const aoVals = [1.5, 3.0, 6.0];
      const acVals = [0.3, 0.6, 1.0];
      const pVals = [0.7, 0.85, 1.0];
      const kVals = [0.1, 0.3, 0.5];
      const peak = 280;

      const corners: number[] = [];
      for (const ao of aoVals) {
        for (const ac of acVals) {
          for (const P of pVals) {
            for (const k of kVals) {
              corners.push(Math.max(0, ss(ao, P, peak, k) - ss(ac, P, peak, k)));
            }
          }
        }
      }

      const expectedLow = Number(Math.min(...corners).toFixed(1));
      const expectedHigh = Number(Math.max(...corners).toFixed(1));

      expect(result.value.deltaLow).toBe(expectedLow);
      expect(result.value.deltaHigh).toBe(expectedHigh);
    });

    it("verifies use_hepa_purifier deltaLow/High equal true min/max over all parameter corners", () => {
      const action = getActionById("use_hepa_purifier")!;
      const result = action.evaluate(baseProfile, context);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const acVals = [0.3, 0.6, 1.0];
      const pVals = [0.7, 0.85, 1.0];
      const kVals = [0.1, 0.3, 0.5];
      const cadrVals = [50 * 4.0, 50 * 4.5, 50 * 5.0];
      const cout = 200;
      const V = 50;

      const corners: number[] = [];
      for (const ac of acVals) {
        for (const P of pVals) {
          for (const k of kVals) {
            for (const cadr of cadrVals) {
              const unpurified = ss(ac, P, cout, k, 0, V);
              const purified = ss(ac, P, cout, k, cadr, V);
              corners.push(Math.max(0, unpurified - purified));
            }
          }
        }
      }

      const expectedLow = Number(Math.min(...corners).toFixed(1));
      const expectedHigh = Number(Math.max(...corners).toFixed(1));

      expect(result.value.deltaLow).toBe(expectedLow);
      expect(result.value.deltaHigh).toBe(expectedHigh);
    });

    it("includes assumptions.default_room_volume when roomVolumeM3 is not provided in profile", () => {
      const profileNoVolume: HouseholdProfile = {
        ...baseProfile,
        home: {
          ...baseProfile.home,
          roomVolumeM3: undefined,
        },
      };

      for (const actionId of [
        "ventilate_at_cleanest_hour",
        "keep_windows_closed_in_peak",
        "use_hepa_purifier",
      ]) {
        const action = getActionById(actionId)!;
        const result = action.evaluate(profileNoVolume, context);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.assumptions).toContain("assumptions.default_room_volume");
        }
      }
    });
  });
});
