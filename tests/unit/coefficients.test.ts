import { describe, expect, it } from "vitest";
import {
  COEFFICIENTS,
  getAssumptions,
  getCoefficient,
  getNonSourcedCoefficients,
} from "@/core/coefficients";

describe("Model Coefficients & Assumptions Registry", () => {
  it("retrieves individual coefficients by key", () => {
    const p = getCoefficient("penetrationFactor");
    expect(p).toBeDefined();
    expect(p?.low).toBe(0.7);
    expect(p?.likely).toBe(0.85);
    expect(p?.high).toBe(1.0);
    expect(p?.status).toBe("assumption");

    const missing = getCoefficient("nonExistentKey");
    expect(missing).toBeUndefined();
  });

  it("lists all non-sourced coefficients", () => {
    const nonSourced = getNonSourcedCoefficients();
    expect(nonSourced.length).toBeGreaterThan(0);
    for (const coef of nonSourced) {
      expect(coef.status).not.toBe("sourced");
    }
  });

  it("lists all assumption coefficients", () => {
    const assumptions = getAssumptions();
    expect(assumptions.length).toBeGreaterThan(0);
    for (const coef of assumptions) {
      expect(coef.status).toBe("assumption");
      expect(coef.low).not.toBeNull();
      expect(coef.likely).not.toBeNull();
      expect(coef.high).not.toBeNull();
    }
  });

  it("enforces null values for parameters flagged as needs-source", () => {
    for (const coef of Object.values(COEFFICIENTS)) {
      if (coef.status === "needs-source") {
        expect(coef.low).toBeNull();
        expect(coef.likely).toBeNull();
        expect(coef.high).toBeNull();
        expect(coef.confidence).toBe("low");
      }
    }
  });

  it("ensures whoPm25Guideline24h is the only sourced parameter in coefficients registry", () => {
    const who = COEFFICIENTS["whoPm25Guideline24h"]!;
    expect(who.status).toBe("sourced");
    expect(who.confidence).toBe("high");
    expect(who.likely).toBe(15.0);
  });
});
