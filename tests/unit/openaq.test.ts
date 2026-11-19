import { describe, expect, it, vi } from "vitest";
import { OpenAqAdapter } from "@/adapters/openaq";

describe("OpenAqAdapter", () => {
  const dummyLoc = { lat: 28.6139, lng: 77.209, label: "New Delhi" };

  it("returns misconfigured error when API key is missing or blank", async () => {
    const adapter1 = new OpenAqAdapter({ apiKey: undefined });
    const res1 = await adapter1.getAirQuality(dummyLoc);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.error.code).toBe("misconfigured");
      expect(res1.error.retryable).toBe(false);
    }

    const adapter2 = new OpenAqAdapter({ apiKey: "   " });
    const res2 = await adapter2.getAirQuality(dummyLoc);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe("misconfigured");
    }
  });

  it("returns not_found when no stations with PM2.5 sensors exist within radius", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          results: [
            {
              id: 999,
              coordinates: { latitude: 28.6139, longitude: 77.209 },
              sensors: [{ id: 1, parameter: { name: "no2" } }], // only NO2, no PM2.5
            },
          ],
        }),
    });

    const adapter = new OpenAqAdapter({
      apiKey: "test_key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await adapter.getAirQuality(dummyLoc);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("not_found");
      expect(res.error.message).toContain("No active PM2.5");
    }
  });

  it("rejects measurements older than maxAgeMinutes as stale", async () => {
    const staleTime = "2026-11-19T01:00:00Z";
    const nowTime = new Date("2026-11-19T06:00:00Z").getTime(); // 5 hours later (>180 min)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          results: [
            {
              id: 100,
              coordinates: { latitude: 28.6139, longitude: 77.209 },
              sensors: [
                {
                  id: 1,
                  parameter: { name: "pm25" },
                  latest: { value: 120, datetime: { utc: staleTime } },
                },
              ],
            },
          ],
        }),
    });

    const adapter = new OpenAqAdapter({
      apiKey: "test_key",
      fetchFn: mockFetch as unknown as typeof fetch,
      nowFn: () => nowTime,
      maxAgeMinutes: 180,
    });

    const res = await adapter.getAirQuality(dummyLoc);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("invalid_response");
      expect(res.error.message).toContain("stale");
    }
  });

  it("rejects implausible readings > 1500 ug/m3 or negative readings", async () => {
    const makeAdapter = (value: number) => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            results: [
              {
                id: 100,
                coordinates: { latitude: 28.6139, longitude: 77.209 },
                sensors: [
                  {
                    id: 1,
                    parameter: { name: "pm25" },
                    latest: { value, datetime: { utc: "2026-11-19T05:50:00Z" } },
                  },
                ],
              },
            ],
          }),
      });

      return new OpenAqAdapter({
        apiKey: "test_key",
        fetchFn: mockFetch as unknown as typeof fetch,
        nowFn: () => new Date("2026-11-19T06:00:00Z").getTime(),
      });
    };

    const resTooHigh = await makeAdapter(1850).getAirQuality(dummyLoc);
    expect(resTooHigh.ok).toBe(false);
    if (!resTooHigh.ok) {
      expect(resTooHigh.error.message).toContain("Implausible");
    }

    const resNegative = await makeAdapter(-5).getAirQuality(dummyLoc);
    expect(resNegative.ok).toBe(false);
    if (!resNegative.ok) {
      expect(resNegative.error.message).toContain("Implausible");
    }
  });
});
