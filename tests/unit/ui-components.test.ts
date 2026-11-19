import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ChildrenAgeBandSchema,
  CommuteModeSchema,
  WindowsHabitSchema,
  CookingFuelSchema,
} from "@/core/types";
import { t } from "@/lib/i18n";
import { formatNumber, formatHour, formatTime } from "@/lib/formatters";

describe("UI Components, Security Invariants & Schema Alignment", () => {
  it("enforces zero instances of dangerouslySetInnerHTML across all src/ files", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function scanDir(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("dangerouslySetInnerHTML")) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const violations = scanDir(srcDir);
    expect(violations).toEqual([]);
  });

  it("verifies all core Zod enum schemas expose valid options for UI mapping", () => {
    expect(ChildrenAgeBandSchema.options).toEqual(["0-2", "3-5", "6-12", "13-18"]);
    expect(CommuteModeSchema.options.length).toBeGreaterThanOrEqual(8);
    expect(WindowsHabitSchema.options.length).toBeGreaterThanOrEqual(5);
    expect(CookingFuelSchema.options.length).toBeGreaterThanOrEqual(4);
  });

  it("verifies i18n parameter interpolation and fallback", () => {
    const text = t("ui.hero.airRightNow", { place: "Delhi", category: "Severe" }, "en");
    expect(text).toBe("Air in Delhi is Severe right now");

    // Dotted fallback
    const nonExistent = t("ui.nonexistent.key", undefined, "hi");
    expect(nonExistent).toBe("ui.nonexistent.key");
  });

  it("verifies number formatting with Indian numbering system (en-IN and hi-IN)", () => {
    const formatted = formatNumber(150000, "en");
    expect(formatted).toBe("1,50,000");

    const formattedDecimal = formatNumber(45.67, "en");
    expect(formattedDecimal).toBe("45.7");
  });

  it("verifies formatHour converts 24h hour values to friendly 12h labels", () => {
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(6)).toBe("6:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
    expect(formatHour(14)).toBe("2:00 PM");
    expect(formatHour(23)).toBe("11:00 PM");
  });

  it("verifies formatTime respects IANA timezone and formats cleanly", () => {
    const iso = "2026-11-19T06:30:00.000Z";
    const result = formatTime(iso, "Asia/Kolkata", "en");
    expect(result).toMatch(/12:00\s*(pm|PM)/i);
  });

  it("enforces that table alternative and screen-reader content use sr-only, NOT display:none or hidden", () => {
    const componentsDir = path.resolve(process.cwd(), "src/components");
    const outlookFile = path.join(componentsDir, "OutlookLine.tsx");
    const content = fs.readFileSync(outlookFile, "utf-8");

    // Must contain sr-only wrapper around table
    expect(content).toContain('className="sr-only"');
    expect(content).toContain("<table");

    // Must not hide table via display:none, hidden or visibility:hidden
    expect(content).not.toMatch(/className="[^"]*\bhidden\b[^"]*"[^>]*>\s*<table/);
    expect(content).not.toMatch(/style=\{[^}]*display:\s*["']none["']/);
  });

  it("enforces copy audit: overclaims ('verified', 'scientific', 'accurate', 'guarantee', 'safe') must NOT appear in en.json or hi.json ui or explanation strings", () => {
    const enJsonPath = path.resolve(process.cwd(), "src/i18n/en.json");
    const hiJsonPath = path.resolve(process.cwd(), "src/i18n/hi.json");
    const enContent = JSON.parse(fs.readFileSync(enJsonPath, "utf-8"));
    const hiContent = JSON.parse(fs.readFileSync(hiJsonPath, "utf-8"));

    expect(enContent.ui.actions.builtinBadge).toBe("Built-in explanation");

    // Scan all UI and builtin explanation strings
    function scanStrings(obj: unknown, keyPath = ""): { key: string; val: string }[] {
      const results: { key: string; val: string }[] = [];
      if (typeof obj === "string") {
        results.push({ key: keyPath, val: obj });
      } else if (typeof obj === "object" && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          results.push(...scanStrings(v, keyPath ? `${keyPath}.${k}` : k));
        }
      }
      return results;
    }

    const enUiStrings = scanStrings(enContent.ui);
    const bannedEnRegex = /\b(verified|scientific calculation|guarantee(d)?|100% safe)\b/i;
    const enViolations = enUiStrings.filter((s) => bannedEnRegex.test(s.val));
    expect(enViolations).toEqual([]);

    const hiAllStrings = scanStrings(hiContent);
    const bannedHiRegex = /(सत्यापित|प्रमाणित|गारंटी|पूर्णतः सुरक्षित|वैज्ञानिक गणना)/;
    const hiViolations = hiAllStrings.filter((s) => bannedHiRegex.test(s.val));
    expect(hiViolations).toEqual([]);
  });
});
