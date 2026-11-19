import type { DayPlan, TimeWindow } from "./dayplan";
import type { Language } from "./types";
import {
  CALENDAR_DETAILS_MAX_LENGTH,
  CALENDAR_TITLE_MAX_LENGTH,
  MAX_CALENDAR_EVENTS,
} from "./heuristics";

const CALENDAR_STRINGS = {
  en: {
    cleanestOutdoorTitle: "Cleanest outdoor window",
    cleanestOutdoorDetails:
      "BreatheWise routine advisory: Forecast pollution is lowest during this window. Ideal time for essential outdoor errands.",
    ventilationTitle: "Airing and ventilation window",
    ventilationDetails:
      "BreatheWise routine advisory: Outdoor air is currently cleaner than estimated indoor levels. Open windows for cross-ventilation.",
    sealWindowsTitle: "Seal windows before smog surge",
    sealWindowsDetails:
      "BreatheWise routine advisory: Ambient particulate levels are forecast to rise. Seal exterior windows and doors.",
  },
  hi: {
    cleanestOutdoorTitle: "बाहरी कार्यों के लिए सबसे स्वच्छ समय",
    cleanestOutdoorDetails:
      "ब्रीदवाइज परामर्श: पूर्वानुमान के अनुसार इस समय प्रदूषण सबसे कम है। आवश्यक बाहरी कार्यों के लिए उपयुक्त समय।",
    ventilationTitle: "कमरे में हवा आने देने का समय",
    ventilationDetails:
      "ब्रीदवाइज परामर्श: बाहरी हवा वर्तमान में इनडोर स्तरों से अपेक्षाकृत बेहतर है। क्रॉस-वेंटिलेशन के लिए खिड़कियां खोलें।",
    sealWindowsTitle: "स्मॉग बढ़ने से पहले खिड़कियां बंद करें",
    sealWindowsDetails:
      "ब्रीदवाइज परामर्श: वायु में प्रदूषण कणों के स्तर बढ़ने का पूर्वानुमान है। बाहरी खिड़कियां और दरवाजे पूरी तरह बंद रखें।",
  },
} as const;

export interface CalendarUrlOptions {
  readonly title: string;
  readonly startLocalIso: string;
  readonly endLocalIso: string;
  readonly timezone: string;
  readonly details?: string;
}

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly details: string;
  readonly url: string;
}

/**
 * Strips non-printable control characters from calendar text.
 */
function sanitizeText(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

/**
 * Formats an ISO string into Google Calendar compact local format: YYYYMMDDTHHmmss.
 */
function formatCalendarDate(isoTimestamp: string, timezone: string): string {
  try {
    const d = new Date(isoTimestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour") === "24" ? "00" : getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");
    return `${year}${month}${day}T${hour}${minute}${second}`;
  } catch {
    const d = new Date(isoTimestamp);
    return d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  }
}

/**
 * Builds a standardized Google Calendar event template URL.
 *
 * Privacy Invariants:
 * - NEVER includes user coordinates, health flags, age bands, or home address.
 * - Caps title and details to prevent URI overflow.
 */
export function buildCalendarTemplateUrl(options: CalendarUrlOptions): string {
  const cleanTitle = sanitizeText(options.title).slice(0, CALENDAR_TITLE_MAX_LENGTH);
  const cleanDetails = sanitizeText(options.details ?? "").slice(0, CALENDAR_DETAILS_MAX_LENGTH);

  const startFormatted = formatCalendarDate(options.startLocalIso, options.timezone);
  const endFormatted = formatCalendarDate(options.endLocalIso, options.timezone);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: cleanTitle,
    dates: `${startFormatted}/${endFormatted}`,
    ctz: options.timezone,
  });

  if (cleanDetails.length > 0) {
    params.set("details", cleanDetails);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calculateWindowEnd(window: TimeWindow): string {
  const startEpoch = new Date(window.startLocalIso).getTime();
  return new Date(startEpoch + window.durationHours * 3600 * 1000).toISOString();
}

/**
 * Plans at most 3 calendar events from a computed DayPlan.
 *
 * @param dayPlan - Evaluated day plan.
 * @param timezone - IANA timezone.
 * @param language - User language for localized title and description.
 * @returns Array of at most 3 CalendarEvent objects.
 */
export function planCalendarEvents(
  dayPlan: DayPlan,
  timezone = "UTC",
  language: Language = "en",
): CalendarEvent[] {
  if (dayPlan.dataStatus === "forecast_unavailable") {
    return [];
  }

  const strings = CALENDAR_STRINGS[language] ?? CALENDAR_STRINGS.en;
  const events: CalendarEvent[] = [];

  // 1. Best Outdoor Window
  if (dayPlan.bestOutdoorWindow) {
    const w = dayPlan.bestOutdoorWindow;
    const endIso = calculateWindowEnd(w);
    const title = strings.cleanestOutdoorTitle;
    const details = strings.cleanestOutdoorDetails;
    events.push({
      id: "best_outdoor_window",
      title,
      startIso: w.startLocalIso,
      endIso,
      details,
      url: buildCalendarTemplateUrl({
        title,
        startLocalIso: w.startLocalIso,
        endLocalIso: endIso,
        timezone,
        details,
      }),
    });
  }

  // 2. Best Ventilation Window
  if (dayPlan.bestVentilationWindow) {
    const w = dayPlan.bestVentilationWindow;
    const endIso = calculateWindowEnd(w);
    const title = strings.ventilationTitle;
    const details = strings.ventilationDetails;
    events.push({
      id: "best_ventilation_window",
      title,
      startIso: w.startLocalIso,
      endIso,
      details,
      url: buildCalendarTemplateUrl({
        title,
        startLocalIso: w.startLocalIso,
        endLocalIso: endIso,
        timezone,
        details,
      }),
    });
  }

  // 3. Close Windows at Start of First Avoid Window
  if (dayPlan.avoidWindows.length > 0) {
    const firstAvoid = dayPlan.avoidWindows[0]!;
    const startIso = firstAvoid.startLocalIso;
    const startMs = new Date(startIso).getTime();

    if (startIso && !isNaN(startMs)) {
      const endIso = new Date(startMs + 1800 * 1000).toISOString();
      const title = strings.sealWindowsTitle;
      const details = strings.sealWindowsDetails;
      events.push({
        id: "seal_windows_alert",
        title,
        startIso,
        endIso,
        details,
        url: buildCalendarTemplateUrl({
          title,
          startLocalIso: startIso,
          endLocalIso: endIso,
          timezone,
          details,
        }),
      });
    }
  }

  return events.slice(0, MAX_CALENDAR_EVENTS);
}
