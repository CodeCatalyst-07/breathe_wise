import type {
  AirQualityPort,
  ClockPort,
  GeocodingPort,
  HouseholdProfile,
  LlmClient,
  LoggerPort,
  PriorTurn,
  WeatherPort,
} from "@/core";

export interface PipelineDependencies {
  readonly airQuality: AirQualityPort;
  readonly weather?: WeatherPort;
  readonly geocoding?: GeocodingPort;
  readonly llm?: LlmClient;
  readonly clock?: ClockPort;
  readonly logger?: LoggerPort;
}

export interface AdviceRequest {
  readonly profile: HouseholdProfile;
  readonly requestId?: string;
  readonly now?: string;
}

export interface QuestionRequest {
  readonly profile: HouseholdProfile;
  readonly question: string;
  readonly priorTurns?: readonly PriorTurn[];
  readonly requestId?: string;
  readonly now?: string;
}

export interface QuestionResponse {
  readonly answer?: string;
  readonly explanationSource?: "ai" | "builtin";
  readonly declined?: boolean;
  readonly reasonKey?: string;
  readonly safetyNoticeKey?: string;
}
