import type { AdviceResponse } from "./response";
import type { Language } from "./types";

const MAX_SHARE_SUMMARY_LENGTH = 600;

const CATEGORY_NAMES: Record<string, { en: string; hi: string }> = {
  good: { en: "Good", hi: "अच्छा" },
  satisfactory: { en: "Satisfactory", hi: "संतोषजनक" },
  moderate: { en: "Moderate", hi: "मध्यम" },
  poor: { en: "Poor", hi: "खराब" },
  very_poor: { en: "Very Poor", hi: "बहुत खराब" },
  severe: { en: "Severe", hi: "गंभीर" },
};

const ACTION_SHORT_NAMES: Record<string, { en: string; hi: string }> = {
  ventilate_at_cleanest_hour: {
    en: "Ventilate at cleanest forecast hour",
    hi: "सबसे स्वच्छ घंटे पर वेंटिलेशन करें",
  },
  keep_windows_closed_in_peak: {
    en: "Keep windows sealed during smog peak",
    hi: "चरम स्मॉग में खिड़कियां बंद रखें",
  },
  use_hepa_purifier: {
    en: "Run HEPA air purifier continuously",
    hi: "HEPA एयर प्यूरीफायर चलाएं",
  },
  shift_outdoor_activity_to_cleaner_hour: {
    en: "Shift outdoor activity to cleaner hours",
    hi: "बाहरी कार्य स्वच्छ समय पर करें",
  },
  wear_fitted_respirator: {
    en: "Wear a well-fitted N95/FFP2 mask outdoors",
    hi: "बाहर N95 मास्क पहनें",
  },
  switch_commute_mode: {
    en: "Use enclosed, filtered transit (metro/bus)",
    hi: "मेट्रो या बंद बस से यात्रा करें",
  },
  improve_cooking_ventilation: {
    en: "Run kitchen exhaust & isolate living rooms",
    hi: "रसोई का एग्जॉस्ट चलाएं",
  },
  avoid_waste_and_biomass_burning: {
    en: "Avoid & report neighborhood waste burning",
    hi: "कचरा जलाने से बचें व रोकें",
  },
  shared_clean_air_room_for_building: {
    en: "Create shared clean-air room in building",
    hi: "इमारत में साझा स्वच्छ कक्ष बनाएं",
  },
  reduce_vehicle_idling_at_school_gates: {
    en: "Curtail vehicle idling at school gates",
    hi: "स्कूल गेट पर इंजन आइडलिंग रोकें",
  },
  organise_carpool_or_shared_transport: {
    en: "Organize carpooling & shared commutes",
    hi: "कारपूलिंग का उपयोग करें",
  },
  plants_myth_check: {
    en: "Note: potted plants do not filter PM2.5",
    hi: "ध्यान दें: पौधे PM2.5 नहीं घटाते",
  },
};

/**
 * Builds a plain-text shareable summary of today's air quality routine.
 *
 * Privacy Invariants:
 * - NEVER includes user coordinates, health status, family age bands, or profile details.
 * - Guaranteed length <= 600 characters for SMS/WhatsApp sharing.
 */
export function buildShareSummary(advice: AdviceResponse, language: Language = "en"): string {
  const isHi = language === "hi";
  const cat = advice.airQuality.reading.category;
  const catInfo = CATEGORY_NAMES[cat] ?? CATEGORY_NAMES.severe ?? { en: "Severe", hi: "गंभीर" };
  const catName = catInfo[isHi ? "hi" : "en"];
  const pm25 = Math.round(advice.airQuality.reading.pm25);
  const sourceLabel =
    advice.airQuality.reading.kind === "measured"
      ? isHi
        ? "सेंसर द्वारा मापा गया"
        : "measured by station"
      : isHi
        ? "वायुमंडलीय मॉडल अनुमान"
        : "atmospheric model estimate";

  const lines: string[] = [];

  // 1. Header
  const title = isHi
    ? `ब्रीदवाइज दैनिक सलाह: ${advice.location.label}`
    : `BreatheWise Plan: ${advice.location.label}`;
  lines.push(title);

  // 2. Air Quality Verdict
  const verdict = isHi
    ? `हवा: ${catName} (PM2.5: ${pm25} µg/m³, ${sourceLabel})`
    : `Air: ${catName} (PM2.5: ${pm25} µg/m³, ${sourceLabel})`;
  lines.push(verdict);

  // 3. Best Window
  if (advice.dayPlan.bestOutdoorWindow) {
    const w = advice.dayPlan.bestOutdoorWindow;
    const windowStr = isHi
      ? `सबसे साफ समय: ${w.startHourLocal}:00-${w.endHourLocal}:00`
      : `Cleanest window: ${w.startHourLocal}:00-${w.endHourLocal}:00`;
    lines.push(windowStr);
  } else if (advice.outlook.cleanestHour) {
    const ch = advice.outlook.cleanestHour;
    const windowStr = isHi
      ? `सबसे कम स्मॉग: लगभग ${ch.hourLocal}:00 बजे`
      : `Cleanest time: around ${ch.hourLocal}:00`;
    lines.push(windowStr);
  }

  // 4. Top 3 Actions
  lines.push(isHi ? "मुख्य सुरक्षा उपाय:" : "Key actions:");
  const topActions = advice.actions.slice(0, 3);
  for (const act of topActions) {
    const actId = act.result.actionId;
    const item = ACTION_SHORT_NAMES[actId];
    const actLabel = item ? item[isHi ? "hi" : "en"] : actId;
    lines.push(`• ${actLabel}`);
  }

  // 5. Disclaimer & Attribution
  const footer = isHi
    ? "ये अनुमान व सामान्य मार्गदर्शन हैं; मान्यताओं के लिए ऐप देखें। चिकित्सीय सलाह नहीं।"
    : "These are estimates and general guidance; see the app for assumptions. Not medical advice.";
  lines.push(`--\n${footer}`);

  const combined = lines.join("\n");
  if (combined.length <= MAX_SHARE_SUMMARY_LENGTH) {
    return combined;
  }
  return combined.slice(0, MAX_SHARE_SUMMARY_LENGTH - 1) + "…";
}
