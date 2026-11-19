import type { Language } from "@/core/types";

/**
 * Formats a numeric value with standard Indian numbering convention (lakhs/crores).
 */
export function formatNumber(value: number, lang: Language = "en"): string {
  const locale = lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Formats an ISO 8601 date string to localized time string using IANA timezone.
 */
export function formatTime(
  isoString: string,
  timezone: string = "Asia/Kolkata",
  lang: Language = "en",
): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const locale = lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN";
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats an hour integer (0-23) to a friendly 12-hour string (e.g. 14 -> "2:00 PM").
 */
export function formatHour(hourLocal: number): string {
  const normalized = ((hourLocal % 24) + 24) % 24;
  const period = normalized >= 12 ? "PM" : "AM";
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${displayHour}:00 ${period}`;
}
