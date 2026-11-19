import { z } from "zod";
import {
  ChildrenAgeBandSchema,
  CommuteModeSchema,
  CookingFuelSchema,
  LanguageSchema,
  WindowsHabitSchema,
} from "@/core";

/**
 * Strict location schema ensuring bounded coordinates, capped label length, and optional timezone.
 */
export const ApiLocationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().min(1).max(200),
    timezone: z.string().max(100).optional(),
  })
  .strict();

export const ApiHouseholdVulnerabilitySchema = z
  .object({
    childrenAgeBands: z.array(ChildrenAgeBandSchema),
    hasElderly: z.boolean(),
    hasRespiratoryCondition: z.boolean(),
  })
  .strict();

export const ApiHomeAttributesSchema = z
  .object({
    roomVolumeM3: z.number().positive().max(1000).optional(),
    windowsHabit: WindowsHabitSchema,
    purifierCadrM3h: z.number().nonnegative().max(2000).optional(),
    cookingFuel: CookingFuelSchema,
  })
  .strict();

/**
 * Strict API profile schema ensuring all nested objects reject unknown properties.
 */
export const ApiHouseholdProfileSchema = z
  .object({
    location: ApiLocationSchema,
    household: ApiHouseholdVulnerabilitySchema,
    commuteMode: CommuteModeSchema,
    home: ApiHomeAttributesSchema,
    budgetInr: z.number().nonnegative().max(1000000).optional(),
    language: LanguageSchema,
  })
  .strict();

export type ApiHouseholdProfile = z.infer<typeof ApiHouseholdProfileSchema>;

/** Request schema for POST /api/advice */
export const AdviceRequestBodySchema = z
  .object({
    profile: ApiHouseholdProfileSchema,
  })
  .strict();

export type AdviceRequestBody = z.infer<typeof AdviceRequestBodySchema>;

/** Request schema for POST /api/explain */
export const ExplainRequestBodySchema = z
  .object({
    profile: ApiHouseholdProfileSchema,
  })
  .strict();

export type ExplainRequestBody = z.infer<typeof ExplainRequestBodySchema>;

/** Prior turn item in chat history */
export const ChatHistoryItemSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

/** Request schema for POST /api/ask */
export const AskRequestBodySchema = z
  .object({
    profile: ApiHouseholdProfileSchema,
    question: z.string().min(1).max(300),
    history: z.array(ChatHistoryItemSchema).max(3).optional(),
  })
  .strict();

export type AskRequestBody = z.infer<typeof AskRequestBodySchema>;

/** Request schema for POST /api/parse-profile */
export const ParseProfileRequestBodySchema = z
  .object({
    text: z.string().min(1).max(500),
    language: LanguageSchema.default("en"),
  })
  .strict();

export type ParseProfileRequestBody = z.infer<typeof ParseProfileRequestBodySchema>;

/** Query parameters schema for GET /api/geocode */
export const GeocodeQuerySchema = z
  .object({
    q: z.string().min(2).max(100),
    lang: LanguageSchema.optional(),
  })
  .strict();

export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;
