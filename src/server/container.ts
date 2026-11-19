import { AirQualityCompositeAdapter } from "@/adapters/air-quality-composite";
import { GeocodingAdapter } from "@/adapters/geocoding";
import { JarvisLabsGemmaAdapter } from "@/adapters/jarvislabs-gemma";
import { OpenMeteoAdapter } from "@/adapters/open-meteo";
import { OpenAqAdapter } from "@/adapters/openaq";
import type { GeocodingPort, LlmClient } from "@/core";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  CachedAirQualityAdapter,
  CachedGeocodingAdapter,
  CachedWeatherAdapter,
} from "./cached-adapters";
import { createPipeline, Pipeline } from "./pipeline";
import type { PipelineDependencies } from "./pipeline-types";

export interface AppContainer {
  readonly pipeline: Pipeline;
  readonly geocoding: GeocodingPort;
  readonly llm?: LlmClient;
}

let pipelineInstance: Pipeline | undefined;
let testContainer: AppContainer | undefined;

/**
 * Creates or retrieves the singleton Pipeline instance with real cached adapters.
 * Lazy initialization reads configuration from validated environment variables.
 */
export function getPipeline(overrides?: Partial<PipelineDependencies>): Pipeline {
  if (overrides) {
    return createPipeline({
      airQuality: overrides.airQuality ?? getRealAirQualityAdapter(),
      weather: overrides.weather ?? getRealWeatherAdapter(),
      geocoding: overrides.geocoding ?? getRealGeocodingAdapter(),
      llm: overrides.llm ?? getRealLlmAdapter(),
      clock: overrides.clock,
      logger: overrides.logger ?? logger,
    });
  }

  if (!pipelineInstance) {
    pipelineInstance = createPipeline({
      airQuality: getRealAirQualityAdapter(),
      weather: getRealWeatherAdapter(),
      geocoding: getRealGeocodingAdapter(),
      llm: getRealLlmAdapter(),
      logger,
    });
  }

  return pipelineInstance;
}

/**
 * Returns the application dependency container. In test environments, returns injected test container if set.
 */
export function getContainer(): AppContainer {
  if (testContainer) return testContainer;
  return {
    pipeline: getPipeline(),
    geocoding: getRealGeocodingAdapter(),
    llm: getRealLlmAdapter(),
  };
}

/**
 * Injects a mock or test container for isolated test execution without network I/O.
 */
export function setContainerForTests(container: AppContainer | undefined): void {
  testContainer = container;
}

/**
 * Resets container state and cached singletons.
 */
export function resetContainer(): void {
  testContainer = undefined;
  pipelineInstance = undefined;
}

function getRealAirQualityAdapter(): CachedAirQualityAdapter {
  const env = getEnv();
  const openAq = new OpenAqAdapter({
    apiKey: env.OPENAQ_API_KEY,
    radiusKm: env.OPENAQ_RADIUS_KM,
    maxAgeMinutes: env.OPENAQ_MAX_AGE_MINUTES,
  });
  const openMeteo = new OpenMeteoAdapter();
  const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
  return new CachedAirQualityAdapter(composite);
}

function getRealWeatherAdapter(): CachedWeatherAdapter {
  const openMeteo = new OpenMeteoAdapter();
  return new CachedWeatherAdapter(openMeteo);
}

function getRealGeocodingAdapter(): CachedGeocodingAdapter {
  const geocoding = new GeocodingAdapter();
  return new CachedGeocodingAdapter(geocoding);
}

function getRealLlmAdapter(): JarvisLabsGemmaAdapter | undefined {
  const env = getEnv();
  if (!env.JARVISLABS_API_KEY || env.JARVISLABS_API_KEY.trim() === "") {
    return undefined;
  }
  return new JarvisLabsGemmaAdapter({
    apiKey: env.JARVISLABS_API_KEY,
    baseUrl: env.JARVISLABS_BASE_URL,
    model: env.JARVISLABS_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
    maxConcurrency: env.LLM_MAX_CONCURRENCY,
  });
}

/**
 * Resets the cached singleton pipeline instance. Useful for unit and integration test isolation.
 */
export function resetPipeline(): void {
  resetContainer();
}
