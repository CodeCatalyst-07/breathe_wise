import type { ActionContext } from "@/core/actions";
import type { HouseholdProfile } from "@/core/types";

export interface GoldenScenario {
  readonly id: string;
  readonly description: string;
  readonly profile: HouseholdProfile;
  readonly context: ActionContext;
  readonly isDataAvailable: boolean;
}

export const GOLDEN_SCENARIOS: Record<string, GoldenScenario> = {
  infantWithPurifier: {
    id: "infant_household_with_purifier",
    description: "Infant household with owned HEPA purifier on a Poor smog day",
    profile: {
      location: { lat: 28.6139, lng: 77.209, label: "Rohini, Delhi" },
      household: {
        childrenAgeBands: ["0-2"],
        hasElderly: false,
        hasRespiratoryCondition: false,
      },
      commuteMode: "metro",
      home: {
        roomVolumeM3: 50,
        windowsHabit: "closed_all_day",
        purifierCadrM3h: 300,
        cookingFuel: "electric_induction",
      },
      budgetInr: 10000,
      language: "en",
    },
    context: {
      airQuality: {
        pm25: 110,
        source: "openaq",
        observedAt: "2026-11-19T06:00:00Z",
        kind: "measured",
        hourlyForecast: [
          { timestamp: "2026-11-19T00:00:00Z", pm25: 100 },
          { timestamp: "2026-11-19T06:00:00Z", pm25: 140 }, // Peak
          { timestamp: "2026-11-19T14:00:00Z", pm25: 70 }, // Cleanest
          { timestamp: "2026-11-19T20:00:00Z", pm25: 120 },
        ],
      },
    },
    isDataAvailable: true,
  },

  elderlyWithoutPurifierSevere: {
    id: "elderly_household_no_purifier_severe",
    description: "Elderly household without an air purifier on a Severe winter smog day",
    profile: {
      location: { lat: 28.5355, lng: 77.391, label: "Noida Sector 62" },
      household: {
        childrenAgeBands: [],
        hasElderly: true,
        hasRespiratoryCondition: true,
      },
      commuteMode: "walk",
      home: {
        roomVolumeM3: 60,
        windowsHabit: "morning_ventilate",
        purifierCadrM3h: undefined, // No owned purifier
        cookingFuel: "lpg",
      },
      budgetInr: 5000,
      language: "en",
    },
    context: {
      airQuality: {
        pm25: 320,
        source: "openaq",
        observedAt: "2026-11-19T07:00:00Z",
        kind: "measured",
        hourlyForecast: [
          { timestamp: "2026-11-19T00:00:00Z", pm25: 300 },
          { timestamp: "2026-11-19T07:00:00Z", pm25: 380 }, // Peak
          { timestamp: "2026-11-19T15:00:00Z", pm25: 260 }, // Cleanest
          { timestamp: "2026-11-19T21:00:00Z", pm25: 340 },
        ],
      },
    },
    isDataAvailable: true,
  },

  twoWheelerCommuterModerate: {
    id: "two_wheeler_commuter_moderate",
    description: "Young adult commuter on a motorcycle on a Moderate AQI day",
    profile: {
      location: { lat: 28.4595, lng: 77.0266, label: "Cyber City, Gurugram" },
      household: {
        childrenAgeBands: [],
        hasElderly: false,
        hasRespiratoryCondition: false,
      },
      commuteMode: "two_wheeler",
      home: {
        roomVolumeM3: 45,
        windowsHabit: "evening_ventilate",
        cookingFuel: "piped_natural_gas",
      },
      language: "en",
    },
    context: {
      airQuality: {
        pm25: 75,
        source: "open-meteo",
        observedAt: "2026-11-19T08:00:00Z",
        kind: "model",
        hourlyForecast: [
          { timestamp: "2026-11-19T00:00:00Z", pm25: 70 },
          { timestamp: "2026-11-19T08:00:00Z", pm25: 85 }, // Peak
          { timestamp: "2026-11-19T14:00:00Z", pm25: 50 }, // Cleanest
          { timestamp: "2026-11-19T20:00:00Z", pm25: 75 },
        ],
      },
    },
    isDataAvailable: true,
  },

  airQualityUnavailable: {
    id: "air_quality_unavailable",
    description:
      "Fallback conservative guidance when all external AQI sensors and models are offline",
    profile: {
      location: { lat: 28.7041, lng: 77.1025, label: "Rural Periphery, Delhi NCR" },
      household: {
        childrenAgeBands: ["6-12"],
        hasElderly: false,
        hasRespiratoryCondition: true,
      },
      commuteMode: "bus",
      home: {
        windowsHabit: "ventilate_as_needed",
        cookingFuel: "biomass_wood",
      },
      language: "en",
    },
    context: {
      airQuality: {
        pm25: 0,
        source: "unavailable",
        observedAt: "2026-11-19T08:00:00Z",
        kind: "measured",
        hourlyForecast: [],
      },
    },
    isDataAvailable: false,
  },
};
