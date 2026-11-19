import { describe, expect, it } from "vitest";

function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("WCAG 2.1 AA Color Contrast Automated Verification", () => {
  const COLORS = {
    paper: "#F2F5F6",
    surface: "#FFFFFF",
    ink: "#14262F",
    inkMuted: "#4A5E68",
    action: "#0B6E8A",
    actionHover: "#08566C",
    tintGood: "#E8F5EE",
    tintSatisfactory: "#F2F7E6",
    tintModerate: "#FFF8E6",
    tintPoor: "#FDF1EB",
    tintVeryPoor: "#FBECEE",
    tintSevere: "#F7E8EF",
    markGood: "#1E7F5C",
    markSatisfactory: "#5B7815",
    markModerate: "#946A00",
    markPoor: "#D2571F",
    markVeryPoor: "#B3243A",
    markSevere: "#6B1B3A",
  };

  it("verifies primary text (Ink) on white Surface exceeds 7.0:1 (AAA level)", () => {
    const ratio = getContrastRatio(COLORS.ink, COLORS.surface);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("verifies primary text (Ink) on background Paper exceeds 7.0:1 (AAA level)", () => {
    const ratio = getContrastRatio(COLORS.ink, COLORS.paper);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it("verifies secondary text (Ink Muted) on Surface meets WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(COLORS.inkMuted, COLORS.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies secondary text (Ink Muted) on Paper meets WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(COLORS.inkMuted, COLORS.paper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies button text (White on Action blue) meets WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(COLORS.surface, COLORS.action);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies button hover text (White on ActionHover blue) meets WCAG AA (>= 4.5:1)", () => {
    const ratio = getContrastRatio(COLORS.surface, COLORS.actionHover);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies primary text (Ink) on all CPCB category light tints exceeds 10:1", () => {
    const tints = [
      COLORS.tintGood,
      COLORS.tintSatisfactory,
      COLORS.tintModerate,
      COLORS.tintPoor,
      COLORS.tintVeryPoor,
      COLORS.tintSevere,
    ];

    for (const tint of tints) {
      const ratio = getContrastRatio(COLORS.ink, tint);
      expect(ratio).toBeGreaterThanOrEqual(10.0);
    }
  });

  it("verifies category marks meet WCAG AA large-text / graphical UI requirement (>= 3.0:1) on white surface", () => {
    const marks = [
      COLORS.markGood,
      COLORS.markSatisfactory,
      COLORS.markModerate,
      COLORS.markPoor,
      COLORS.markVeryPoor,
      COLORS.markSevere,
    ];

    for (const mark of marks) {
      const ratio = getContrastRatio(mark, COLORS.surface);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    }
  });
});
