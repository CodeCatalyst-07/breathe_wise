/**
 * Data provider and model attribution notices.
 * Required for open data license compliance and transparency.
 */

/**
 * OpenAQ attribution notice.
 */
export const ATTRIBUTION_OPENAQ = "Data provided by OpenAQ (https://openaq.org)";

/**
 * Open-Meteo & Copernicus Atmosphere Monitoring Service (CAMS) attribution notice.
 */
export const ATTRIBUTION_OPEN_METEO_CAMS =
  "Open-Meteo, based on CAMS ENSEMBLE data provider (Copernicus Atmosphere Monitoring Service)";

/**
 * Google Gemma LLM model attribution notice.
 */
export const ATTRIBUTION_GEMMA =
  "Explanations synthesized using Google Gemma 4 31B IT via Jarvis Labs API";

/**
 * Consolidated list of attributions for display in UI footers or API metadata.
 */
export const DATA_ATTRIBUTIONS = [
  ATTRIBUTION_OPENAQ,
  ATTRIBUTION_OPEN_METEO_CAMS,
  ATTRIBUTION_GEMMA,
] as const;
