import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "@/lib/geo";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceKm(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
  });

  it("calculates known distance between New Delhi and Mumbai accurately", () => {
    // New Delhi: 28.6139, 77.2090
    // Mumbai: 19.0760, 72.8777
    const dist = haversineDistanceKm(28.6139, 77.209, 19.076, 72.8777);
    // Great circle distance is ~1148 km
    expect(dist).toBeGreaterThan(1140);
    expect(dist).toBeLessThan(1160);
  });

  it("calculates known distance between London and Paris", () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    // Great circle distance is ~343-344 km
    expect(dist).toBeGreaterThan(340);
    expect(dist).toBeLessThan(350);
  });

  it("is symmetric under point reversal", () => {
    const d1 = haversineDistanceKm(28.6139, 77.209, 28.65, 77.3);
    const d2 = haversineDistanceKm(28.65, 77.3, 28.6139, 77.209);
    expect(d1).toBe(d2);
  });
});
