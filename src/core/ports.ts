import type {
  AirQualitySnapshot,
  HouseholdProfile,
  ImpactResult,
  Language,
  Location,
  WeatherSnapshot,
} from "./types";
import type { PurifierLabelResult } from "./cadr";
export type { PurifierLabelResult } from "./cadr";

/**
 * Standard typed Result container representing either success or an expected operational failure.
 * Used across all provider interfaces to avoid unhandled promise rejections.
 */
export type Result<T, E = ProviderError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Helper to construct a successful Result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Helper to construct a failure Result.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Structured failure information for external provider interactions.
 */
export interface ProviderError {
  /** Identifier for error classification (e.g. TIMEOUT, UPSTREAM_5XX, NOT_FOUND) */
  readonly code: string;
  /** Human-readable diagnostics message (safe to log internally) */
  readonly message: string;
  /** HTTP response status code if originated from an upstream HTTP call */
  readonly upstreamStatus?: number;
  /** Whether the caller can safely retry the operation with backoff */
  readonly retryable: boolean;
  /** Original underlying cause if available */
  readonly cause?: unknown;
}

/**
 * Port contract for retrieving ambient air quality observations and particulate forecasts.
 */
export interface AirQualityProvider {
  /**
   * Fetches latest air quality observations and available hourly forecasts for the given location.
   *
   * @param location - Target geographic coordinates.
   * @returns Result containing AirQualitySnapshot on success or ProviderError on failure.
   */
  getAirQuality(location: Location): Promise<Result<AirQualitySnapshot, ProviderError>>;
}

/**
 * Port contract for retrieving atmospheric meteorological conditions.
 */
export interface WeatherProvider {
  /**
   * Fetches hourly weather forecast (wind speed, humidity, temperature, rain) for the given location.
   *
   * @param location - Target geographic coordinates.
   * @returns Result containing WeatherSnapshot on success or ProviderError on failure.
   */
  getWeather(location: Location): Promise<Result<WeatherSnapshot, ProviderError>>;
}

/**
 * Port contract for resolving user queries to coordinates and vice versa.
 */
export interface GeocodingProvider {
  /**
   * Resolves a free-form place name or address search to ranked geographic coordinates.
   *
   * @param query - Search term entered by user (e.g., "Rohini Sector 9, Delhi").
   * @returns Result containing array of matched locations or ProviderError.
   */
  searchLocation(query: string): Promise<Result<Location[], ProviderError>>;

  /**
   * Resolves coordinates to a human-readable neighborhood/city label.
   *
   * @param lat - Latitude.
   * @param lng - Longitude.
   * @returns Result containing resolved Location or ProviderError.
   */
  reverseGeocode(lat: number, lng: number): Promise<Result<Location, ProviderError>>;
}

export type AirQualityPort = AirQualityProvider;
export type WeatherPort = WeatherProvider;
export type GeocodingPort = GeocodingProvider;

export interface ClockPort {
  nowIso(): string;
}

export interface LoggerPort {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface ApplicationError {
  readonly code:
    | "validation_error"
    | "upstream_error"
    | "assistant_unavailable"
    | "rate_limited"
    | "internal_error";
  readonly message: string;
}

/**
 * Parameters passed to the LLM explanation service.
 * Invariant: The LLM receives pre-computed numerical results and never invents numbers.
 */
export interface ExplanationRequest {
  /** Pre-calculated deterministic impact results */
  readonly impactResults?: ImpactResult[];
  readonly results?: readonly ImpactResult[];
  /** Target output language for the assistant ("en" or "hi") */
  readonly language: Language;
  /** Sanitized summary of the scenario (demographics / vulnerability attributes are strictly omitted or anonymized) */
  readonly scenarioContext?: {
    readonly commuteMode: HouseholdProfile["commuteMode"];
    readonly windowsHabit: HouseholdProfile["home"]["windowsHabit"];
    readonly cookingFuel: HouseholdProfile["home"]["cookingFuel"];
    readonly locationLabel: string;
  };
  readonly category?: string;
  readonly vulnerable?: boolean;
  readonly placeLabel?: string;
  readonly disallowedTokens?: readonly string[];
}

/**
 * Structure of the generated assistant response.
 */
export interface ExplanationResponse {
  /** Narrative summary explaining the numerical trade-offs and practical advice */
  readonly narrative: string;
  /** Specific per-action contextual advice keyed by actionId */
  readonly actionCommentaries: Array<{
    readonly actionId: string;
    readonly commentary: string;
  }>;
  /** Language the explanation was rendered in */
  readonly language: Language;
  /** Model identifier that produced the explanation */
  readonly modelUsed: string;
}

export interface PriorTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface QuestionLlmRequest {
  readonly groundingContext: string;
  readonly question: string;
  readonly priorTurns?: readonly PriorTurn[];
  readonly language: Language;
}

/**
 * Port contract for the GenAI language model client (e.g. Google Gemma 4 31B IT via Jarvis Labs).
 * Strictly scoped to contextual explanations and routine synthesis; never computes raw numbers.
 */
export interface LlmClient {
  /**
   * Synthesizes user-friendly, empathetic explanations for pre-computed impact calculations.
   *
   * @param request - Validated calculation outcomes and language choice.
   * @returns Result containing structured narrative explanation or ProviderError.
   */
  generateExplanation(
    request: ExplanationRequest,
  ): Promise<Result<ExplanationResponse, ProviderError>>;

  /**
   * Answers a follow-up user question using grounding context.
   *
   * @param request - Validated grounding context and question.
   * @returns Result containing generated answer or ProviderError.
   */
  answer?(request: QuestionLlmRequest): Promise<Result<string, ProviderError>>;

  /**
   * Extracts household profile attributes from unstructured user text.
   *
   * @param freeText - Raw user text describing their living situation.
   * @param language - Preferred language.
   * @returns Result containing extracted profile attributes or ProviderError.
   */
  parseProfile?(
    freeText: string,
    language?: Language,
  ): Promise<Result<Record<string, unknown>, ProviderError>>;

  /**
   * Reads specifications from an air purifier label photo.
   *
   * @param imageBase64 - Base64 encoded image string.
   * @param mimeType - Image mime type (image/jpeg, image/png, image/webp).
   * @returns Result containing extracted CADR, units, and brand or ProviderError.
   */
  readPurifierLabel?(
    imageBase64: string,
    mimeType: string,
  ): Promise<Result<PurifierLabelResult, ProviderError>>;
}
