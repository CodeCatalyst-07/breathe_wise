"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HouseholdProfileSchema,
  type HouseholdProfile,
  type Location,
  type Language,
} from "@/core/types";

const SESSION_STORAGE_KEY = "breathewise_household_profile";

export const DEFAULT_DELHI_LOCATION: Location = {
  lat: 28.6139,
  lng: 77.209,
  label: "Delhi NCR (Central)",
  timezone: "Asia/Kolkata",
};

export function createDefaultProfile(
  location: Location = DEFAULT_DELHI_LOCATION,
  language: Language = "en",
): HouseholdProfile {
  return {
    location,
    household: {
      childrenAgeBands: [],
      hasElderly: false,
      hasRespiratoryCondition: false,
    },
    commuteMode: "metro",
    home: {
      roomVolumeM3: 45,
      windowsHabit: "closed_all_day",
      purifierCadrM3h: 0,
      cookingFuel: "lpg",
    },
    language,
  };
}

export function useSessionProfile(initialLanguage: Language = "en") {
  const [profile, setProfileState] = useState<HouseholdProfile>(() => {
    return createDefaultProfile(DEFAULT_DELHI_LOCATION, initialLanguage);
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from sessionStorage on mount in browser
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const result = HouseholdProfileSchema.safeParse(parsed);
          if (result.success) {
            setProfileState(result.data);
          }
        }
      }
    } catch {
      // Ignore parse or storage errors, retain default
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Update profile and persist to sessionStorage
  const updateProfile = useCallback((updated: HouseholdProfile) => {
    setProfileState(updated);
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Storage quota or restriction failure
    }
  }, []);

  // Set location only, preserving existing profile preferences
  const updateLocation = useCallback((location: Location) => {
    setProfileState((prev) => {
      const next: HouseholdProfile = { ...prev, location };
      try {
        if (typeof window !== "undefined" && window.sessionStorage) {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }, []);

  // Clear all profile data from React state and sessionStorage
  const clearProfile = useCallback(() => {
    const fresh = createDefaultProfile(DEFAULT_DELHI_LOCATION, profile.language);
    setProfileState(fresh);
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage error
    }
  }, [profile.language]);

  return {
    profile,
    isLoaded,
    updateProfile,
    updateLocation,
    clearProfile,
  };
}
