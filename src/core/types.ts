import { z } from "zod";

/** Age brackets for children in the household. */
export const ChildrenAgeBandSchema = z.enum(["0-2", "3-5", "6-12", "13-18"]);
export type ChildrenAgeBand = z.infer<typeof ChildrenAgeBandSchema>;

/** Primary modes of commute used by household members. */
export const CommuteModeSchema = z.enum([
  "walk",
  "bicycle",
  "two_wheeler",
  "auto_rickshaw",
  "car",
  "bus",
  "metro",
  "train",
  "work_from_home",
]);
export type CommuteMode = z.infer<typeof CommuteModeSchema>;

/** Daily window ventilation habits in the residence. */
export const WindowsHabitSchema = z.enum([
  "always_open",
  "morning_ventilate",
  "afternoon_ventilate",
  "evening_ventilate",
  "closed_all_day",
  "ventilate_as_needed",
]);
export type WindowsHabit = z.infer<typeof WindowsHabitSchema>;

/** Primary cooking fuel used indoors. */
export const CookingFuelSchema = z.enum([
  "lpg",
  "electric_induction",
  "piped_natural_gas",
  "biomass_wood",
  "kerosene",
]);
export type CookingFuel = z.infer<typeof CookingFuelSchema>;

/** Supported UI and explanation languages. */
export const LanguageSchema = z.enum(["en", "hi"]);
export type Language = z.infer<typeof LanguageSchema>;

/** Geographic location coordinates and optional descriptive label. */
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().min(1),
  timezone: z.string().optional(),
});
export type Location = z.infer<typeof LocationSchema>;

/** Session-only demographic and respiratory vulnerability indicators. Never persisted. */
export const HouseholdVulnerabilitySchema = z.object({
  childrenAgeBands: z.array(ChildrenAgeBandSchema),
  hasElderly: z.boolean(),
  hasRespiratoryCondition: z.boolean(),
});
export type HouseholdVulnerability = z.infer<typeof HouseholdVulnerabilitySchema>;

/** Residential indoor environment attributes. */
export const HomeAttributesSchema = z.object({
  roomVolumeM3: z.number().positive().optional(),
  windowsHabit: WindowsHabitSchema,
  purifierCadrM3h: z.number().nonnegative().optional(),
  cookingFuel: CookingFuelSchema,
});
export type HomeAttributes = z.infer<typeof HomeAttributesSchema>;

/** Profile describing the household, commute, residence, and budget constraints. */
export const HouseholdProfileSchema = z.object({
  location: LocationSchema,
  household: HouseholdVulnerabilitySchema,
  commuteMode: CommuteModeSchema,
  home: HomeAttributesSchema,
  budgetInr: z.number().nonnegative().optional(),
  language: LanguageSchema,
});
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;

/** Source provider for air quality observation. */
export const AirQualitySourceSchema = z.enum(["openaq", "open-meteo", "unavailable"]);
export type AirQualitySource = z.infer<typeof AirQualitySourceSchema>;

/** Distinguishes direct physical ground station measurements from atmospheric model forecasts. */
export const AirQualityKindSchema = z.enum(["measured", "model"]);
export type AirQualityKind = z.infer<typeof AirQualityKindSchema>;

/** Single hourly particulate forecast point. */
export const HourlyAirQualityPointSchema = z.object({
  timestamp: z.string().datetime(),
  pm25: z.number().nonnegative(),
  pm10: z.number().nonnegative().optional(),
});
export type HourlyAirQualityPoint = z.infer<typeof HourlyAirQualityPointSchema>;

/** Comparison metrics between physical ground sensors and atmospheric models. */
export const DivergenceInfoSchema = z.object({
  isDivergent: z.boolean(),
  ratio: z.number().positive(),
  measuredPm25: z.number().nonnegative().optional(),
  modelPm25: z.number().nonnegative().optional(),
});
export type DivergenceInfo = z.infer<typeof DivergenceInfoSchema>;

/** Snapshot of ambient air quality at a given location and timestamp. */
export const AirQualitySnapshotSchema = z.object({
  pm25: z.number().nonnegative(),
  pm10: z.number().nonnegative().optional(),
  source: AirQualitySourceSchema,
  observedAt: z.string().datetime(),
  stationDistanceKm: z.number().nonnegative().optional(),
  kind: AirQualityKindSchema,
  timezone: z.string().optional(),
  divergence: DivergenceInfoSchema.optional(),
  hourlyForecast: z.array(HourlyAirQualityPointSchema),
});
export type AirQualitySnapshot = z.infer<typeof AirQualitySnapshotSchema>;

/** Single hourly meteorological record (wind speed unit: meters per second m/s). */
export const HourlyWeatherRecordSchema = z.object({
  timestamp: z.string().datetime(),
  windSpeedMs: z.number().nonnegative(),
  windDirectionDeg: z.number().min(0).max(360).optional(),
  humidityPercent: z.number().min(0).max(100),
  temperatureC: z.number(),
  precipitationMm: z.number().nonnegative(),
});
export type HourlyWeatherRecord = z.infer<typeof HourlyWeatherRecordSchema>;

/** Atmospheric weather forecast snapshot used to evaluate indoor ventilation dispersion. */
export const WeatherSnapshotSchema = z.object({
  hourly: z.array(HourlyWeatherRecordSchema),
  timezone: z.string().optional(),
});
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;

/** Estimation confidence rating for impact projections. */
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/** Presentation mode for an action's evaluation output. */
export const DisplayModeSchema = z.enum(["numeric", "directional", "myth-check"]);
export type DisplayMode = z.infer<typeof DisplayModeSchema>;

/** Qualitative direction of an intervention effect when no verified numeric delta exists. */
export const QualitativeDirectionSchema = z.enum([
  "reduces",
  "likely_reduces",
  "neutral",
  "ineffective",
]);
export type QualitativeDirection = z.infer<typeof QualitativeDirectionSchema>;

/** Quantified delta result for an intervention or daily routine modification. */
export const ImpactResultSchema = z
  .object({
    actionId: z.string().min(1),
    displayMode: DisplayModeSchema.default("numeric"),
    direction: QualitativeDirectionSchema.optional(),
    baseline: z.number().optional(),
    scenario: z.number().optional(),
    deltaLow: z.number().optional(),
    deltaLikely: z.number().optional(),
    deltaHigh: z.number().optional(),
    unit: z.string().min(1).optional(),
    assumptions: z.array(z.string()),
    sources: z.array(z.string()),
    confidence: ConfidenceLevelSchema,
    costInr: z.number().nonnegative().optional(),
    minutes: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (data.displayMode === "numeric") {
        if (
          data.deltaLow === undefined ||
          data.deltaLikely === undefined ||
          data.deltaHigh === undefined ||
          data.baseline === undefined ||
          data.scenario === undefined ||
          data.unit === undefined
        ) {
          return false;
        }
        return data.deltaLow <= data.deltaLikely && data.deltaLikely <= data.deltaHigh;
      }
      return true;
    },
    {
      message:
        "deltaLow must be less than or equal to deltaLikely, and deltaLikely must be less than or equal to deltaHigh",
      path: ["deltaLikely"],
    },
  );
export type ImpactResult = z.infer<typeof ImpactResultSchema>;

/** CPCB-style standardized PM2.5 air quality category level. */
export const AqiCategoryLevelSchema = z.enum([
  "good",
  "satisfactory",
  "moderate",
  "poor",
  "very_poor",
  "severe",
]);
export type AqiCategoryLevel = z.infer<typeof AqiCategoryLevelSchema>;

/** Temporal basis of an air quality reading. */
export const AqiBasisSchema = z.enum(["instantaneous", "24h_average"]);
export type AqiBasis = z.infer<typeof AqiBasisSchema>;

/** Labelled categorization of a PM2.5 concentration with transparency on basis and kind. */
export interface AqiReading {
  readonly concentration: number;
  readonly pm25?: number;
  readonly category: AqiCategoryLevel;
  readonly aqiNumber?: number;
  readonly kind: AirQualityKind;
  readonly basis: AqiBasis;
  readonly labelKey: string;
  readonly basisLabelKey: string;
  readonly ordinal: number;
}

/** Environment categories in a user's daily exposure schedule. */
export const EnvironmentTypeSchema = z.enum(["outdoor", "commute", "indoor"]);
export type EnvironmentType = z.infer<typeof EnvironmentTypeSchema>;

/** Contiguous segment of daily routine in a specific microenvironment. */
export const ScheduleSegmentSchema = z.object({
  startHour: z.number().min(0).max(24),
  endHour: z.number().min(0).max(24),
  environment: EnvironmentTypeSchema,
});
export type ScheduleSegment = z.infer<typeof ScheduleSegmentSchema>;

/** Daily 24-hour routine schedule composed of non-overlapping microenvironment segments. */
export const DayScheduleSchema = z.object({
  segments: z.array(ScheduleSegmentSchema),
});
export type DaySchedule = z.infer<typeof DayScheduleSchema>;
