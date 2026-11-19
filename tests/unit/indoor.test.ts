import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateIndoorConcentration, recommendPurifierCadr } from "@/core/indoor";

describe("Indoor Air Quality Model (Steady-State Single-Compartment)", () => {
  describe("Hand-computed arithmetic verification", () => {
    /**
     * Documented hand-calculation:
     * Parameters:
     *   a = 0.6 1/h (air exchange rate, closed)
     *   P = 0.85 (likely penetration factor)
     *   Cout = 200 ug/m3
     *   S = 0 ug/h
     *   V = 50 m3
     *   k = 0.3 1/h (likely deposition rate)
     *   CADR = 250 m3/h
     *   runFraction = 1.0
     *
     * Steady-state formula:
     *   Cin = (a * P * Cout + S/V) / (a + k + CADReff / V)
     *
     * Numerator:
     *   a * P * Cout = 0.6 * 0.85 * 200 = 102.0 ug/(m3 * h)
     *
     * Denominator:
     *   a + k + CADR / V = 0.6 + 0.3 + 250 / 50 = 0.9 + 5.0 = 5.9 1/h
     *
     * Cin (purified):
     *   102.0 / 5.9 = 17.28813... -> rounds to 17.29 ug/m3
     *
     * Unpurified (CADR = 0):
     *   Denominator = 0.6 + 0.3 = 0.9 1/h
     *   Cin = 102.0 / 0.9 = 113.333... -> rounds to 113.33 ug/m3
     */
    it("matches exact hand-computed arithmetic step-by-step", () => {
      const purifiedResult = calculateIndoorConcentration({
        outdoorPm25: 200,
        roomVolumeM3: 50,
        airExchangeRatePerHour: 0.6,
        penetrationFactor: 0.85,
        depositionRatePerHour: 0.3,
        purifierCadrM3h: 250,
        runFraction: 1.0,
      });

      expect(purifiedResult.ok).toBe(true);
      if (purifiedResult.ok) {
        expect(purifiedResult.value.likely).toBe(17.29);
      }

      const unpurifiedResult = calculateIndoorConcentration({
        outdoorPm25: 200,
        roomVolumeM3: 50,
        airExchangeRatePerHour: 0.6,
        penetrationFactor: 0.85,
        depositionRatePerHour: 0.3,
        purifierCadrM3h: 0,
      });

      expect(unpurifiedResult.ok).toBe(true);
      if (unpurifiedResult.ok) {
        expect(unpurifiedResult.value.likely).toBe(113.33);
      }
    });

    it("evaluates indoor source emission term (S/V)", () => {
      // S = 5000 ug/h, V = 50 m3 -> S/V = 100 ug/m3/h
      // Denominator: 0.6 + 0.3 = 0.9
      // Cin = (102 + 100) / 0.9 = 202 / 0.9 = 224.444... -> 224.44
      const result = calculateIndoorConcentration({
        outdoorPm25: 200,
        roomVolumeM3: 50,
        airExchangeRatePerHour: 0.6,
        penetrationFactor: 0.85,
        depositionRatePerHour: 0.3,
        purifierCadrM3h: 0,
        indoorSourceUgPerHour: 5000,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.likely).toBe(224.44);
      }
    });
  });

  describe("Input guards and validations", () => {
    it("rejects non-positive room volume", () => {
      const zeroV = calculateIndoorConcentration({
        outdoorPm25: 100,
        roomVolumeM3: 0,
        airExchangeRatePerHour: 0.6,
      });
      expect(zeroV.ok).toBe(false);

      const negV = calculateIndoorConcentration({
        outdoorPm25: 100,
        roomVolumeM3: -20,
        airExchangeRatePerHour: 0.6,
      });
      expect(negV.ok).toBe(false);
    });

    it("rejects negative outdoor concentration or air exchange rate", () => {
      const negConc = calculateIndoorConcentration({
        outdoorPm25: -50,
        roomVolumeM3: 40,
        airExchangeRatePerHour: 0.6,
      });
      expect(negConc.ok).toBe(false);

      const negA = calculateIndoorConcentration({
        outdoorPm25: 100,
        roomVolumeM3: 40,
        airExchangeRatePerHour: -1.0,
      });
      expect(negA.ok).toBe(false);
    });

    it("rejects non-finite inputs", () => {
      const nanRes = calculateIndoorConcentration({
        outdoorPm25: Number.NaN,
        roomVolumeM3: 40,
        airExchangeRatePerHour: 0.6,
      });
      expect(nanRes.ok).toBe(false);
    });
  });

  describe("Purifier Sizing Helper", () => {
    it("calculates ACH-based CADR recommendation correctly", () => {
      // V = 40 m3, ACH = 4.0, 4.5, 5.0 -> CADR = 160, 180, 200 m3/h
      const sizing = recommendPurifierCadr(40);
      expect(sizing.ok).toBe(true);
      if (sizing.ok) {
        expect(sizing.value.minCadrM3h).toBe(160);
        expect(sizing.value.recommendedCadrM3h).toBe(180);
        expect(sizing.value.maxCadrM3h).toBe(200);
      }
    });

    it("rejects invalid room volume in sizing helper", () => {
      expect(recommendPurifierCadr(-10).ok).toBe(false);
      expect(recommendPurifierCadr(0).ok).toBe(false);
      expect(recommendPurifierCadr(Number.NaN).ok).toBe(false);
    });
  });

  describe("Property-based invariants (fast-check)", () => {
    it("property: indoor concentration is monotonically increasing in Cout", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 200, noNaN: true }),
          fc.double({ min: 201, max: 600, noNaN: true }),
          fc.double({ min: 20, max: 150, noNaN: true }),
          (cOutLow, cOutHigh, volume) => {
            const lowRes = calculateIndoorConcentration({
              outdoorPm25: cOutLow,
              roomVolumeM3: volume,
              airExchangeRatePerHour: 0.6,
            });
            const highRes = calculateIndoorConcentration({
              outdoorPm25: cOutHigh,
              roomVolumeM3: volume,
              airExchangeRatePerHour: 0.6,
            });
            return lowRes.ok && highRes.ok && lowRes.value.likely <= highRes.value.likely;
          },
        ),
      );
    });

    it("property: purifier never increases indoor concentration", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 500, noNaN: true }),
          fc.double({ min: 20, max: 150, noNaN: true }),
          fc.double({ min: 50, max: 600, noNaN: true }),
          (cOut, volume, cadr) => {
            const noPurifier = calculateIndoorConcentration({
              outdoorPm25: cOut,
              roomVolumeM3: volume,
              airExchangeRatePerHour: 0.6,
              purifierCadrM3h: 0,
            });
            const withPurifier = calculateIndoorConcentration({
              outdoorPm25: cOut,
              roomVolumeM3: volume,
              airExchangeRatePerHour: 0.6,
              purifierCadrM3h: cadr,
            });
            return (
              noPurifier.ok &&
              withPurifier.ok &&
              withPurifier.value.likely <= noPurifier.value.likely
            );
          },
        ),
      );
    });

    it("property: low <= likely <= high concentration invariant holds", () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 600, noNaN: true }),
          fc.double({ min: 15, max: 200, noNaN: true }),
          fc.double({ min: 0.2, max: 6.0, noNaN: true }),
          fc.double({ min: 0, max: 500, noNaN: true }),
          (cOut, volume, ach, cadr) => {
            const res = calculateIndoorConcentration({
              outdoorPm25: cOut,
              roomVolumeM3: volume,
              airExchangeRatePerHour: ach,
              purifierCadrM3h: cadr,
            });
            return (
              res.ok && res.value.low <= res.value.likely && res.value.likely <= res.value.high
            );
          },
        ),
      );
    });
  });
});
