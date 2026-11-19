import { describe, expect, it } from "vitest";
import * as Core from "@/core";

describe("Core Index Re-exports", () => {
  it("exports all core types, schemas, ports, and algorithms", () => {
    expect(Core.COEFFICIENTS).toBeDefined();
    expect(Core.ACTIONS).toBeDefined();
    expect(Core.RULES_BY_CATEGORY).toBeDefined();
    expect(Core.calculateIndoorConcentration).toBeDefined();
    expect(Core.calculateTimeWeightedExposure).toBeDefined();
    expect(Core.getAqiCategory).toBeDefined();
    expect(Core.rankActions).toBeDefined();
    expect(Core.collectAllowedNumbers).toBeDefined();
    expect(Core.findDisallowedNumbers).toBeDefined();
    expect(Core.ok).toBeDefined();
    expect(Core.err).toBeDefined();
    expect(Core.HouseholdProfileSchema).toBeDefined();
    expect(Core.ImpactResultSchema).toBeDefined();
  });
});
