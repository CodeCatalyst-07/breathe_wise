import { z } from "zod";
import { DivergenceInfoSchema, ImpactResultSchema } from "./types";

export const AqiReadingSchema = z.object({
  pm25: z.number(),
  concentration: z.number().optional(),
  category: z.enum(["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]),
  aqiNumber: z.number().optional(),
  kind: z.enum(["measured", "model"]),
  basis: z.enum(["instantaneous", "24h_average"]),
  labelKey: z.string().optional(),
  basisLabelKey: z.string().optional(),
  ordinal: z.number().optional(),
});
export type AqiReadingModel = z.infer<typeof AqiReadingSchema>;

export const LocationSummarySchema = z.object({
  label: z.string(),
  roundedLat: z.number(),
  roundedLng: z.number(),
});
export type LocationSummary = z.infer<typeof LocationSummarySchema>;

export const HourlyExtremeSchema = z.object({
  timestamp: z.string(),
  hourLocal: z.number(),
  pm25: z.number(),
});

export const ForecastOutlookSchema = z.object({
  status: z.enum(["improving", "worsening", "stable", "unavailable"]),
  cleanestHour: HourlyExtremeSchema.optional(),
  worstHour: HourlyExtremeSchema.optional(),
  next12hAvg: z.number().optional(),
  following12hAvg: z.number().optional(),
  difference: z.number().optional(),
  thresholdUsed: z.number(),
});
export type ForecastOutlookModel = z.infer<typeof ForecastOutlookSchema>;

export const HourlySlotSchema = z.object({
  hourLocal: z.number(),
  timestamp: z.string(),
  pm25: z.number(),
  category: z.enum(["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]),
  outdoorActivity: z.enum(["ok", "limit", "avoid"]),
  ventilationOk: z.boolean(),
});

export const TimeWindowSchema = z.object({
  startLocalIso: z.string(),
  endLocalIso: z.string(),
  startHourLocal: z.number(),
  endHourLocal: z.number(),
  avgPm25: z.number(),
  durationHours: z.number(),
  labelKey: z.string(),
  reasonKey: z.string(),
});

export const DayPlanSchema = z.object({
  dataStatus: z.enum(["available", "forecast_unavailable"]),
  slots: z.array(HourlySlotSchema),
  bestOutdoorWindow: TimeWindowSchema.optional(),
  bestVentilationWindow: TimeWindowSchema.optional(),
  avoidWindows: z.array(TimeWindowSchema),
});
export type DayPlanModel = z.infer<typeof DayPlanSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startIso: z.string(),
  endIso: z.string(),
  details: z.string(),
  url: z.string(),
});
export type CalendarEventModel = z.infer<typeof CalendarEventSchema>;

export const BuiltinActionExplanationSchema = z.object({
  actionId: z.string(),
  whatToDoKey: z.string(),
  whyItMattersKey: z.string(),
  assumptionsKeys: z.array(z.string()),
  params: z.record(z.union([z.string(), z.number()])).optional(),
});

export const AdviceActionItemSchema = z.object({
  result: ImpactResultSchema,
  rank: z.number(),
  reasonKey: z.string(),
  builtinExplanation: BuiltinActionExplanationSchema,
  group: z.enum(["household", "community"]),
});
export type AdviceActionItem = z.infer<typeof AdviceActionItemSchema>;

export const AssumptionItemSchema = z.object({
  key: z.string(),
  status: z.enum(["sourced", "assumption", "needs-source"]),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string(),
  description: z.string(),
});
export type AssumptionItem = z.infer<typeof AssumptionItemSchema>;

export const AirQualitySummarySchema = z.object({
  reading: AqiReadingSchema,
  provenance: z.string(),
  attributions: z.array(z.string()),
  divergence: DivergenceInfoSchema.optional(),
});

export const AdviceExplanationSchema = z.object({
  source: z.enum(["ai", "builtin"]),
  summary: z.string(),
  perAction: z.array(
    z.object({
      actionId: z.string(),
      text: z.string(),
    }),
  ),
});
export type AdviceExplanation = z.infer<typeof AdviceExplanationSchema>;

export const AdviceResponseSchema = z.object({
  requestId: z.string().optional(),
  generatedAt: z.string(),
  timezone: z.string(),
  location: LocationSummarySchema,
  dataStatus: z.enum(["available", "unavailable", "forecast_unavailable"]),
  airQuality: AirQualitySummarySchema,
  outlook: ForecastOutlookSchema,
  dayPlan: DayPlanSchema,
  calendarEvents: z.array(CalendarEventSchema),
  actions: z.array(AdviceActionItemSchema),
  assumptions: z.array(AssumptionItemSchema),
  safety: z.object({
    disclaimerKey: z.string(),
    medicalHelpKey: z.string(),
  }),
  explanation: AdviceExplanationSchema.optional(),
});

export type AdviceResponse = z.infer<typeof AdviceResponseSchema>;
