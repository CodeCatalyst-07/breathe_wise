// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSessionProfile,
  createDefaultProfile,
  DEFAULT_DELHI_LOCATION,
} from "@/lib/useSessionProfile";
import { useAdvice } from "@/lib/useAdvice";
import { useGeocode } from "@/lib/useGeocode";
import { ApiClientError } from "@/lib/api-client";
import { HouseholdProfileSchema } from "@/core/types";
import type { AdviceResponse } from "@/core/response";

const MOCK_ADVICE: AdviceResponse = {
  generatedAt: "2026-11-19T06:00:00Z",
  timezone: "Asia/Kolkata",
  location: { label: "Delhi NCR", roundedLat: 28.61, roundedLng: 77.21 },
  dataStatus: "available",
  airQuality: {
    reading: { pm25: 120, category: "poor", kind: "measured", basis: "instantaneous" },
    provenance: "Test Station",
    attributions: ["OpenAQ"],
  },
  outlook: { status: "stable", thresholdUsed: 15 },
  dayPlan: { dataStatus: "available", slots: [], avoidWindows: [] },
  calendarEvents: [],
  actions: [],
  assumptions: [],
  safety: {
    disclaimerKey: "safety.disclaimer.general_guidance",
    medicalHelpKey: "safety.medical.seek_help_for_symptoms",
  },
};

const UPGRADED_ADVICE: AdviceResponse = {
  ...MOCK_ADVICE,
  explanation: {
    source: "ai",
    summary: "Air quality is poor today. Run HEPA filtration.",
    perAction: [],
  },
};

describe("UI Hooks, Storage Privacy & Client Resiliency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage?.clear?.();
      } catch {}
      try {
        window.localStorage?.clear?.();
      } catch {}
    }
  });

  it("creates a neutral default profile that strictly passes HouseholdProfileSchema", () => {
    const profile = createDefaultProfile(DEFAULT_DELHI_LOCATION, "en");
    const validated = HouseholdProfileSchema.safeParse(profile);

    expect(validated.success).toBe(true);
    expect(profile.location.label).toBe("Delhi NCR (Central)");
    expect(profile.household.childrenAgeBands).toEqual([]);
    expect(profile.household.hasElderly).toBe(false);
    expect(profile.home.purifierCadrM3h).toBe(0);
    expect(profile.home.roomVolumeM3).toBe(45);
  });

  it("verifies ApiClientError correctly captures status, code, and retry-after header", () => {
    const err = new ApiClientError({
      message: "Rate limit exceeded",
      code: "rate_limited",
      httpStatus: 429,
      retryAfterSeconds: 45,
    });

    expect(err.name).toBe("ApiClientError");
    expect(err.httpStatus).toBe(429);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfterSeconds).toBe(45);
    expect(err.message).toBe("Rate limit exceeded");
  });

  it("enforces session storage privacy invariant: localStorage must NEVER be called and clearProfile clears sessionStorage", () => {
    const localStorageSpy = vi.fn();
    Object.defineProperty(window, "localStorage", {
      value: {
        setItem: localStorageSpy,
        getItem: vi.fn().mockReturnValue(null),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSessionProfile("en"));

    // Update profile
    act(() => {
      result.current.updateProfile({
        ...result.current.profile,
        household: { ...result.current.profile.household, hasElderly: true },
      });
    });

    expect(result.current.profile.household.hasElderly).toBe(true);
    expect(window.sessionStorage.getItem("breathewise_household_profile")).toContain(
      '"hasElderly":true',
    );
    expect(localStorageSpy).not.toHaveBeenCalled();

    // Call clearProfile
    act(() => {
      result.current.clearProfile();
    });

    expect(result.current.profile.household.hasElderly).toBe(false);
    expect(window.sessionStorage.getItem("breathewise_household_profile")).toBeNull();
  });

  it("useGeocode debounces user search queries by 300 ms", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({ data: { candidates: [{ label: "Noida", lat: 28.53, lng: 77.39 }] } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { result, rerender } = renderHook(({ q }) => useGeocode(q), {
      initialProps: { q: "No" },
    });

    // Before debounce timer fires
    expect(fetchSpy).not.toHaveBeenCalled();

    // Re-render quickly with more text
    rerender({ q: "Noida" });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Advance timer past 300 ms
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("Noida"), expect.any(Object));
    expect(result.current.candidates.length).toBe(1);
  });

  it("useAdvice performs fast-path render then async AI upgrade", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/advice")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(MOCK_ADVICE),
        });
      }
      if (url.includes("/api/explain")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(UPGRADED_ADVICE),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const profile = createDefaultProfile();
    const { result } = renderHook(() => useAdvice(profile));

    // Wait for fast advice then explain upgrade
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.advice).toBeDefined();
    expect(result.current.advice?.explanation?.source).toBe("ai");
    expect(result.current.error).toBeNull();
  });

  it("useAdvice keeps built-in advice intact when /api/explain fails", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/advice")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(MOCK_ADVICE),
        });
      }
      if (url.includes("/api/explain")) {
        return Promise.resolve({
          ok: false,
          status: 503,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ error: { message: "LLM unavailable" } }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const profile = createDefaultProfile();
    const { result } = renderHook(() => useAdvice(profile));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Fast advice is kept intact, not broken
    expect(result.current.advice).toBeDefined();
    expect(result.current.advice?.airQuality.reading.pm25).toBe(120);
    expect(result.current.error).toBeNull();
  });

  it("useAdvice captures 429 rate-limited response and exposes retry-in-N-seconds state", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        "content-type": "application/json",
        "Retry-After": "25",
      }),
      json: () =>
        Promise.resolve({ error: { code: "rate_limited", userMessage: "Too many requests" } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const profile = createDefaultProfile();
    const { result } = renderHook(() => useAdvice(profile));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.retryAfter).toBe(25);
    expect(result.current.error).toContain("Rate limit reached");
  });
});
