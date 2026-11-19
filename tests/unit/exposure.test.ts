import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateTimeWeightedExposure, validateSchedule } from "@/core/exposure";
import type { DaySchedule } from "@/core/types";

describe("Daily Exposure Model (Time-Weighted Average)", () => {
  describe("Schedule validation", () => {
    it("accepts valid non-overlapping contiguous schedule", () => {
      const schedule: DaySchedule = {
        segments: [
          { startHour: 0, endHour: 8, environment: "indoor" },
          { startHour: 8, endHour: 9, environment: "commute" },
          { startHour: 9, endHour: 17, environment: "indoor" },
          { startHour: 17, endHour: 24, environment: "indoor" },
        ],
      };

      const result = validateSchedule(schedule);
      expect(result.ok).toBe(true);
    });

    it("accepts partial-day schedule (0-24 coverage is optional)", () => {
      const partial: DaySchedule = {
        segments: [
          { startHour: 9, endHour: 12, environment: "outdoor" },
          { startHour: 14, endHour: 18, environment: "indoor" },
        ],
      };
      expect(validateSchedule(partial).ok).toBe(true);
    });

    it("rejects overlapping segments with typed error", () => {
      const overlapping: DaySchedule = {
        segments: [
          { startHour: 0, endHour: 8, environment: "indoor" },
          { startHour: 7.5, endHour: 10, environment: "commute" }, // Overlaps 7.5 to 8.0
        ],
      };

      const result = validateSchedule(overlapping);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("OVERLAPPING_SEGMENTS");
      }
    });

    it("rejects insufficient hourly points or invalid hourly concentrations", () => {
      const schedule: DaySchedule = {
        segments: [{ startHour: 0, endHour: 4, environment: "indoor" }],
      };

      const shortHourly = Array(12).fill(50);
      const shortRes = calculateTimeWeightedExposure({
        schedule,
        hourlyOutdoorPm25: shortHourly,
        indoorPm25: 30,
      });
      expect(shortRes.ok).toBe(false);
      if (!shortRes.ok) {
        expect(shortRes.error.code).toBe("MISSING_HOURLY_DATA");
      }

      const invalidHourly = Array(24).fill(50);
      invalidHourly[5] = -10;
      const negRes = calculateTimeWeightedExposure({
        schedule,
        hourlyOutdoorPm25: invalidHourly,
        indoorPm25: 30,
      });
      expect(negRes.ok).toBe(false);
      if (!negRes.ok) {
        expect(negRes.error.code).toBe("NON_FINITE_INPUT");
      }
    });

    it("rejects non-finite segment intervals", () => {
      const nonFiniteSchedule: DaySchedule = {
        segments: [{ startHour: Number.NaN, endHour: 8, environment: "indoor" }],
      };
      const res = validateSchedule(nonFiniteSchedule);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("NON_FINITE_INPUT");
      }
    });

    it("handles zero total hours safely in time weighted average calculation", () => {
      const zeroSchedule: DaySchedule = {
        segments: [{ startHour: 8, endHour: 8.0001, environment: "indoor" }],
      };
      const res = calculateTimeWeightedExposure({
        schedule: zeroSchedule,
        hourlyOutdoorPm25: Array(24).fill(50),
        indoorPm25: 30,
      });
      expect(res.ok).toBe(true);
    });
  });

  describe("Hand-computed arithmetic verification", () => {
    /**
     * Hand-calculated scenario:
     * 24-hour profile:
     * - 00:00 to 08:00 (8h indoor @ 30 ug/m3) -> 8 * 30 = 240
     * - 08:00 to 09:00 (1h commute @ 200 ug/m3) -> 1 * 200 = 200
     * - 09:00 to 17:00 (8h indoor @ 40 ug/m3) -> 8 * 40 = 320
     * - 17:00 to 18:00 (1h commute @ 180 ug/m3) -> 1 * 180 = 180
     * - 18:00 to 20:00 (2h outdoor @ 150 ug/m3) -> 2 * 150 = 300
     * - 20:00 to 24:00 (4h indoor @ 30 ug/m3) -> 4 * 30 = 120
     *
     * Total hours = 24
     * Sum = 240 + 200 + 320 + 180 + 300 + 120 = 1360 ug*h/m3
     * TWA = 1360 / 24 = 56.6666... -> rounds to 56.67 ug/m3
     */
    it("matches exact hand-computed time-weighted exposure", () => {
      const schedule: DaySchedule = {
        segments: [
          { startHour: 0, endHour: 8, environment: "indoor" },
          { startHour: 8, endHour: 9, environment: "commute" },
          { startHour: 9, endHour: 17, environment: "indoor" },
          { startHour: 17, endHour: 18, environment: "commute" },
          { startHour: 18, endHour: 20, environment: "outdoor" },
          { startHour: 20, endHour: 24, environment: "indoor" },
        ],
      };

      const hourlyOutdoor = Array(24).fill(100);
      hourlyOutdoor[8] = 200; // 08:00
      hourlyOutdoor[17] = 180; // 17:00
      hourlyOutdoor[18] = 150; // 18:00
      hourlyOutdoor[19] = 150; // 19:00

      const hourlyIndoor = Array(24).fill(30);
      for (let h = 9; h < 17; h++) {
        hourlyIndoor[h] = 40;
      }

      const res = calculateTimeWeightedExposure({
        schedule,
        hourlyOutdoorPm25: hourlyOutdoor,
        indoorPm25: hourlyIndoor,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.totalHours).toBe(24);
        expect(res.value.timeWeightedAverage).toBe(56.67);
        expect(res.value.peakExposure).toBe(200);
        expect(res.value.minExposure).toBe(30);
        expect(res.value.breakdownByEnvironment.indoor.hours).toBe(20);
        expect(res.value.breakdownByEnvironment.commute.hours).toBe(2);
        expect(res.value.breakdownByEnvironment.outdoor.hours).toBe(2);
      }
    });
  });

  describe("Property-based test: TWA lies between min and max inputs", () => {
    it("property: calculated TWA is strictly bounded by minimum and maximum exposures", () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 200, noNaN: true }),
          fc.float({ min: 10, max: 200, noNaN: true }),
          (cIndoor, cOutdoor) => {
            const schedule: DaySchedule = {
              segments: [
                { startHour: 0, endHour: 12, environment: "indoor" },
                { startHour: 12, endHour: 24, environment: "outdoor" },
              ],
            };
            const hourlyOutdoor = Array(24).fill(cOutdoor);

            const res = calculateTimeWeightedExposure({
              schedule,
              hourlyOutdoorPm25: hourlyOutdoor,
              indoorPm25: cIndoor,
            });

            if (!res.ok) return false;
            const minBound = Math.min(cIndoor, cOutdoor) - 0.01;
            const maxBound = Math.max(cIndoor, cOutdoor) + 0.01;

            return (
              res.value.timeWeightedAverage >= minBound && res.value.timeWeightedAverage <= maxBound
            );
          },
        ),
      );
    });
  });
});
