import { describe, expect, it, vi } from "vitest";
import { GeocodingAdapter } from "@/adapters/geocoding";

describe("GeocodingAdapter", () => {
  it("resolves address query to candidate locations with 4-decimal precision", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          results: [
            {
              id: 1,
              name: "Rohini",
              latitude: 28.7495123,
              longitude: 77.0652456,
              country: "India",
              admin1: "Delhi",
            },
          ],
        }),
    });

    const adapter = new GeocodingAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.searchLocation("Rohini", "en");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBe(1);
      expect(res.value[0]?.label).toBe("Rohini, Delhi, India");
      expect(res.value[0]?.lat).toBe(28.7495);
      expect(res.value[0]?.lng).toBe(77.0652);
    }
  });

  it("returns empty array immediately for empty or whitespace query without network call", async () => {
    const mockFetch = vi.fn();
    const adapter = new GeocodingAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.searchLocation("   ");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual([]);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reverseGeocode rounds browser coordinates to 2 decimal places and sets label 'Current location'", async () => {
    const adapter = new GeocodingAdapter();
    const res = await adapter.reverseGeocode(28.613912, 77.209045);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.lat).toBe(28.61);
      expect(res.value.lng).toBe(77.21);
      expect(res.value.label).toBe("Current location");
    }
  });

  it("reverseGeocode rejects invalid latitude or longitude bounds", async () => {
    const adapter = new GeocodingAdapter();
    const res = await adapter.reverseGeocode(95.0, 77.21);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("invalid_response");
      expect(res.error.message).toContain("latitude");
    }
  });

  it("regression: resolves known city 'Delhi' with nullish admin/country and exposes IANA timezone", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          results: [
            {
              id: 1273294,
              name: "Delhi",
              latitude: 28.65195,
              longitude: 77.23149,
              country: "India",
              admin1: null, // nullish field from Open-Meteo
              timezone: "Asia/Kolkata",
            },
          ],
        }),
    });

    const adapter = new GeocodingAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.searchLocation("Delhi");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBe(1);
      expect(res.value[0]?.label).toBe("Delhi, India");
      expect(res.value[0]?.lat).toBe(28.652);
      expect(res.value[0]?.lng).toBe(77.2315);
      expect(res.value[0]?.timezone).toBe("Asia/Kolkata");
    }
  });

  it("regression: falls back to city segment when qualified query returns 0 candidates", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (
        url.includes("name=Connaught+Place%2C+Delhi") ||
        url.includes("name=Connaught+Place%2C+Delhi")
      ) {
        // First attempt with full qualified query returns empty results
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: async () => JSON.stringify({ generationtime_ms: 0.1 }),
        };
      }
      // Fallback query for "Delhi" returns matches
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            results: [
              {
                id: 1273294,
                name: "Delhi",
                latitude: 28.65195,
                longitude: 77.23149,
                country: "India",
                timezone: "Asia/Kolkata",
              },
            ],
          }),
      };
    });

    const adapter = new GeocodingAdapter({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await adapter.searchLocation("Connaught Place, Delhi");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBeGreaterThan(0);
      expect(res.value[0]?.label).toContain("Delhi");
    }
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
