/**
 * Named UX and operational heuristic constants.
 *
 * HONESTY RULE COMPLIANCE:
 * These thresholds are UX heuristics and operational guidelines, NOT scientific constants.
 * They are explicitly flagged as "heuristic - not scientific" or "policy - to be reviewed".
 */

/**
 * Difference in PM2.5 (ug/m3) between next 12h average and following 12h average
 * required to classify trend as "improving" or "worsening" versus "stable".
 * Status: heuristic - not scientific
 */
export const OUTLOOK_DIFF_THRESHOLD_UG_M3 = 15.0;

/**
 * Standard daytime preference window for outdoor activities and natural ventilation (06:00 to 22:00 local).
 * Status: heuristic - not scientific
 */
export const DAY_PLAN_DAYTIME_START_HOUR = 6;
export const DAY_PLAN_DAYTIME_END_HOUR = 22;

/**
 * Bounds on recommended contiguous window length in hours (1 to 2 hours).
 * Status: heuristic - not scientific
 */
export const DAY_PLAN_WINDOW_MIN_HOURS = 1;
export const DAY_PLAN_WINDOW_MAX_HOURS = 2;

/**
 * Maximum number of scheduled Google Calendar template events produced per day plan.
 * Status: heuristic - not scientific
 */
export const MAX_CALENDAR_EVENTS = 3;

/**
 * Length limits for Google Calendar template event strings to prevent URL truncation.
 * Status: heuristic - not scientific
 */
export const CALENDAR_TITLE_MAX_LENGTH = 100;
export const CALENDAR_DETAILS_MAX_LENGTH = 500;

/**
 * Free-text question character limit for assistant follow-up questions.
 * Status: heuristic - not scientific
 */
export const QUESTION_MAX_CHARS = 300;

/**
 * Maximum number of prior conversation turns passed as grounding context.
 * Status: heuristic - not scientific
 */
export const MAX_PRIOR_TURNS = 3;

/**
 * Divergence threshold ratio between physical ground sensor and atmospheric model (> 2.0x).
 * Status: heuristic - not scientific
 */
export const AIR_QUALITY_DIVERGENCE_RATIO_THRESHOLD = 2.0;
