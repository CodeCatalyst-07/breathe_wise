import { describe, expect, it } from "vitest";
import { ImpactResultSchema } from "@/core/types";

describe("ImpactResultSchema", () => {
  const validPayload = {
    actionId: "indoor-hepa-filter",
    baseline: 180,
    scenario: 35,
    deltaLow: 110,
    deltaLikely: 145,
    deltaHigh: 160,
    unit: "µg/m³ PM2.5",
    assumptions: ["Room volume 45m³", "Continuous operation on medium speed"],
    sources: ["ASHRAE Indoor Air Quality Guide 2023"],
    confidence: "high" as const,
    costInr: 4500,
    minutes: 10,
  };

  it("accepts a valid impact result satisfying deltaLow <= deltaLikely <= deltaHigh", () => {
    const parsed = ImpactResultSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.deltaLow).toBe(110);
      expect(parsed.data.deltaLikely).toBe(145);
      expect(parsed.data.deltaHigh).toBe(160);
    }
  });

  it("accepts exact equal boundary deltas", () => {
    const parsed = ImpactResultSchema.safeParse({
      ...validPayload,
      deltaLow: 50,
      deltaLikely: 50,
      deltaHigh: 50,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects when deltaLow is greater than deltaLikely", () => {
    const parsed = ImpactResultSchema.safeParse({
      ...validPayload,
      deltaLow: 150,
      deltaLikely: 100,
      deltaHigh: 160,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message);
      expect(
        messages.some((msg) => msg.includes("deltaLow must be less than or equal to deltaLikely")),
      ).toBe(true);
    }
  });

  it("rejects when deltaLikely is greater than deltaHigh", () => {
    const parsed = ImpactResultSchema.safeParse({
      ...validPayload,
      deltaLow: 100,
      deltaLikely: 170,
      deltaHigh: 160,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message);
      expect(
        messages.some((msg) => msg.includes("deltaLikely must be less than or equal to deltaHigh")),
      ).toBe(true);
    }
  });

  it("rejects negative costs or negative minutes", () => {
    const invalidCost = ImpactResultSchema.safeParse({
      ...validPayload,
      costInr: -500,
    });
    expect(invalidCost.success).toBe(false);

    const invalidMinutes = ImpactResultSchema.safeParse({
      ...validPayload,
      minutes: -10,
    });
    expect(invalidMinutes.success).toBe(false);
  });
});
