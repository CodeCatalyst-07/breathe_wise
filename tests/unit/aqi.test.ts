import { describe, expect, it } from "vitest";
import {
  calculateAqiNumber,
  categorizeReading,
  getAqiCategory,
  getWhoExceedanceRatio,
  WHO_PM25_24H_GUIDELINE,
} from "@/core/aqi";

describe("AQI Scales & Categorization (CPCB)", () => {
  it("exports the WHO 24-hour guideline constant as 15 ug/m3", () => {
    expect(WHO_PM25_24H_GUIDELINE).toBe(15);
  });

  describe("Table-driven category boundaries", () => {
    const boundaryCases: Array<{
      pm25: number;
      expectedCategory: string;
      expectedAqiMin: number;
      expectedAqiMax: number;
    }> = [
      { pm25: 0, expectedCategory: "good", expectedAqiMin: 0, expectedAqiMax: 0 },
      { pm25: 15, expectedCategory: "good", expectedAqiMin: 1, expectedAqiMax: 49 },
      { pm25: 30, expectedCategory: "good", expectedAqiMin: 50, expectedAqiMax: 50 },
      { pm25: 30.1, expectedCategory: "satisfactory", expectedAqiMin: 51, expectedAqiMax: 52 },
      { pm25: 60, expectedCategory: "satisfactory", expectedAqiMin: 100, expectedAqiMax: 100 },
      { pm25: 60.1, expectedCategory: "moderate", expectedAqiMin: 101, expectedAqiMax: 102 },
      { pm25: 90, expectedCategory: "moderate", expectedAqiMin: 200, expectedAqiMax: 200 },
      { pm25: 90.1, expectedCategory: "poor", expectedAqiMin: 201, expectedAqiMax: 202 },
      { pm25: 120, expectedCategory: "poor", expectedAqiMin: 300, expectedAqiMax: 300 },
      { pm25: 120.1, expectedCategory: "very_poor", expectedAqiMin: 301, expectedAqiMax: 302 },
      { pm25: 250, expectedCategory: "very_poor", expectedAqiMin: 400, expectedAqiMax: 400 },
      { pm25: 250.1, expectedCategory: "severe", expectedAqiMin: 401, expectedAqiMax: 402 },
      { pm25: 450, expectedCategory: "severe", expectedAqiMin: 500, expectedAqiMax: 500 },
      { pm25: 600, expectedCategory: "severe", expectedAqiMin: 500, expectedAqiMax: 500 },
    ];

    for (const testCase of boundaryCases) {
      it(`correctly categorizes ${testCase.pm25} ug/m3 as ${testCase.expectedCategory}`, () => {
        const catRes = getAqiCategory(testCase.pm25);
        expect(catRes.ok).toBe(true);
        if (catRes.ok) {
          expect(catRes.value.id).toBe(testCase.expectedCategory);
        }

        const aqiRes = calculateAqiNumber(testCase.pm25);
        expect(aqiRes.ok).toBe(true);
        if (aqiRes.ok) {
          expect(aqiRes.value).toBeGreaterThanOrEqual(testCase.expectedAqiMin);
          expect(aqiRes.value).toBeLessThanOrEqual(testCase.expectedAqiMax);
        }
      });
    }
  });

  describe("Invalid and degenerate inputs", () => {
    it("rejects negative concentration with typed error", () => {
      const res = getAqiCategory(-10);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("NEGATIVE_CONCENTRATION");
      }
    });

    it("rejects NaN and Infinity with typed error", () => {
      const nanRes = getAqiCategory(Number.NaN);
      expect(nanRes.ok).toBe(false);
      if (!nanRes.ok) {
        expect(nanRes.error.code).toBe("NON_FINITE_INPUT");
      }

      const infRes = calculateAqiNumber(Number.POSITIVE_INFINITY);
      expect(infRes.ok).toBe(false);
      if (!infRes.ok) {
        expect(infRes.error.code).toBe("NON_FINITE_INPUT");
      }
    });
  });

  describe("WHO Exceedance Ratio", () => {
    it("calculates exact multiples of 15 ug/m3 threshold", () => {
      const r15 = getWhoExceedanceRatio(15);
      expect(r15.ok).toBe(true);
      if (r15.ok) expect(r15.value).toBe(1.0);

      const r30 = getWhoExceedanceRatio(30);
      expect(r30.ok).toBe(true);
      if (r30.ok) expect(r30.value).toBe(2.0);

      const r150 = getWhoExceedanceRatio(150);
      expect(r150.ok).toBe(true);
      if (r150.ok) expect(r150.value).toBe(10.0);

      const r300 = getWhoExceedanceRatio(300);
      expect(r300.ok).toBe(true);
      if (r300.ok) expect(r300.value).toBe(20.0);
    });

    it("rejects invalid values", () => {
      expect(getWhoExceedanceRatio(-1).ok).toBe(false);
      expect(getWhoExceedanceRatio(Number.NaN).ok).toBe(false);
    });
  });

  describe("Categorized Reading with Basis and Provenance", () => {
    it("distinguishes instantaneous reading from 24h average", () => {
      const instant = categorizeReading({
        concentration: 85,
        kind: "measured",
        basis: "instantaneous",
      });

      expect(instant.ok).toBe(true);
      if (instant.ok) {
        expect(instant.value.category).toBe("moderate");
        expect(instant.value.basis).toBe("instantaneous");
        expect(instant.value.basisLabelKey).toBe("aqi.basis.instantaneous");
        expect(instant.value.ordinal).toBe(2);
      }

      const avg24 = categorizeReading({
        concentration: 85,
        kind: "model",
        basis: "24h_average",
      });

      expect(avg24.ok).toBe(true);
      if (avg24.ok) {
        expect(avg24.value.basis).toBe("24h_average");
        expect(avg24.value.basisLabelKey).toBe("aqi.basis.24h_average");
      }
    });
  });
});
