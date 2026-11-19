import type { Language } from "@/core/types";
import enJson from "@/i18n/en.json";
import hiJson from "@/i18n/hi.json";

type Dict = Record<string, unknown>;

const dictionaries: Record<Language, Dict> = {
  en: enJson as unknown as Dict,
  hi: hiJson as unknown as Dict,
};

function getNestedValue(dict: Dict, keyPath: string[]): string | undefined {
  let curr: unknown = dict;
  for (const seg of keyPath) {
    if (!curr || typeof curr !== "object") return undefined;
    curr = (curr as Record<string, unknown>)[seg];
  }
  return typeof curr === "string" ? curr : undefined;
}

/**
 * Resolves an internationalized string by dot-notated key.
 * If the selected language lacks the key, it cleanly falls back to English.
 * Interpolates `{param}` tokens from the provided params map.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
  lang: Language = "en",
): string {
  const path = key.split(".");
  let template = getNestedValue(dictionaries[lang] ?? dictionaries.en, path);

  if (!template && lang !== "en") {
    template = getNestedValue(dictionaries.en, path);
  }

  if (!template) {
    return key;
  }

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, match) => {
    return params[match] !== undefined ? String(params[match]) : `{${match}}`;
  });
}
