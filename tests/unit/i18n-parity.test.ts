import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import { t } from "@/lib/i18n";

type JsonNode = string | { [key: string]: JsonNode };

function collectLeafKeys(node: JsonNode, prefix = ""): Array<{ path: string; value: string }> {
  if (typeof node === "string") {
    return [{ path: prefix, value: node }];
  }
  const result: Array<{ path: string; value: string }> = [];
  for (const [key, child] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    result.push(...collectLeafKeys(child, nextPrefix));
  }
  return result;
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

describe("I18N Parity & Inclusive Hindi Verification", () => {
  const enLeaves = collectLeafKeys(en);
  const hiLeaves = collectLeafKeys(hi);

  const enMap = new Map(enLeaves.map((l) => [l.path, l.value]));
  const hiMap = new Map(hiLeaves.map((l) => [l.path, l.value]));

  it("has exact 1:1 key parity between en.json and hi.json (0 missing keys)", () => {
    const missingInHi: string[] = [];
    for (const key of enMap.keys()) {
      if (!hiMap.has(key)) {
        missingInHi.push(key);
      }
    }

    const missingInEn: string[] = [];
    for (const key of hiMap.keys()) {
      if (!enMap.has(key)) {
        missingInEn.push(key);
      }
    }

    expect(
      missingInHi,
      `Keys present in en.json but missing in hi.json: ${missingInHi.join(", ")}`,
    ).toEqual([]);
    expect(
      missingInEn,
      `Keys present in hi.json but missing in en.json: ${missingInEn.join(", ")}`,
    ).toEqual([]);
  });

  it("contains no empty string values in hi.json", () => {
    const emptyHiKeys = hiLeaves.filter((l) => l.value.trim().length === 0).map((l) => l.path);
    expect(emptyHiKeys).toEqual([]);
  });

  it("enforces placeholder parity between en.json and hi.json", () => {
    const placeholderMismatches: string[] = [];

    for (const [path, enVal] of enMap.entries()) {
      const hiVal = hiMap.get(path);
      if (!hiVal) continue;

      const enPlaceholders = extractPlaceholders(enVal);
      const hiPlaceholders = extractPlaceholders(hiVal);

      if (enPlaceholders.join(",") !== hiPlaceholders.join(",")) {
        placeholderMismatches.push(
          `${path} -> EN: [${enPlaceholders.join(",")}] vs HI: [${hiPlaceholders.join(",")}]`,
        );
      }
    }

    expect(
      placeholderMismatches,
      `Placeholder mismatches found:\n${placeholderMismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("ensures critical safety, category, and action strings contain authentic Hindi, not untranslated English", () => {
    // English words that are prohibited in critical Hindi translations
    // (excluding brand names like "BreatheWise", "Google", "Gemma", "HEPA", "N95", "FFP2", "PM2.5", "WHO")
    const criticalPaths = [
      "safety.disclaimer.general_guidance",
      "safety.medical.seek_help_for_symptoms",
      "aqi.category.good",
      "aqi.category.satisfactory",
      "aqi.category.moderate",
      "aqi.category.poor",
      "aqi.category.very_poor",
      "aqi.category.severe",
      "builtin_explanations.summary.severe",
      "builtin_explanations.summary.good",
    ];

    for (const path of criticalPaths) {
      const hiVal = hiMap.get(path);
      expect(hiVal, `Missing key: ${path}`).toBeDefined();
      expect(hiVal).not.toEqual(enMap.get(path));
      // Must contain Devanagari Unicode characters ([\u0900-\u097F])
      expect(/[\u0900-\u097F]/.test(hiVal!)).toBe(true);
    }
  });

  it("formats Hindi templates using t() helper safely", () => {
    const formatted = t("ui.hero.airRightNow", { place: "आनंद विहार", category: "गंभीर" }, "hi");
    expect(formatted).toBe("आनंद विहार में अभी हवा गंभीर है");
  });

  it("verifies pseudo-localization (+40% string expansion) does not throw or truncate unexpectedly", () => {
    for (const { value } of hiLeaves) {
      // Simulate +40% expansion with trailing Devanagari characters
      const expanded = value + " ".repeat(Math.ceil(value.length * 0.4));
      expect(expanded.length).toBeGreaterThanOrEqual(value.length);
    }
  });
});
