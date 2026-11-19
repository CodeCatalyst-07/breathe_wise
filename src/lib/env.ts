import "server-only";
import { z } from "zod";

/**
 * Server-only environment variable schema.
 * All secrets and server configurations are strictly parsed and validated here.
 */
export const EnvSchema = z.object({
  /** API key for Jarvis Labs (optional at boot; required when LLM operations are invoked) */
  JARVISLABS_API_KEY: z.string().optional().default(""),
  /** Base URL for OpenAI-compatible Jarvis Labs completions */
  JARVISLABS_BASE_URL: z
    .string()
    .url("JARVISLABS_BASE_URL must be a valid URL")
    .default("https://models.jarvislabs.net/v1"),
  /** Model identifier hosted on Jarvis Labs */
  JARVISLABS_MODEL: z.string().min(1).default("gemma-4-31b-it"),
  /** API key for OpenAQ v3 access (optional; falls back to Open-Meteo if omitted) */
  OPENAQ_API_KEY: z.string().optional().default(""),
  /** Search radius in kilometers for nearest OpenAQ stations */
  OPENAQ_RADIUS_KM: z.coerce.number().positive().default(25),
  /** Maximum acceptable age for station measurements in minutes */
  OPENAQ_MAX_AGE_MINUTES: z.coerce.number().positive().default(180),
  /** Maximum concurrent LLM requests */
  LLM_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
  /** LLM request timeout in milliseconds */
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  /** Global rate limit per minute per client */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  /** Optional multimodal air purifier label scanner feature flag */
  FEATURE_PURIFIER_LABEL: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
  /** Runtime execution environment */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates raw environment dictionary.
 *
 * Security guarantees:
 * - Fails fast if any required variables are missing.
 * - Error message lists ONLY the names of missing or invalid variables, NEVER values.
 * - Explicitly rejects any secret variable bearing a NEXT_PUBLIC_ prefix.
 *
 * @param raw - Environment variable dictionary (defaults to process.env).
 * @returns Fully validated and defaulted Env object.
 */
export function validateEnv(raw: Record<string, unknown> = process.env): Env {
  // Guard against accidental NEXT_PUBLIC_ exposure of secrets
  for (const key of Object.keys(raw)) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("key") ||
        lower.includes("token") ||
        lower.includes("auth") ||
        lower.includes("password")
      ) {
        throw new Error(
          `Security violation: Secret variable "${key}" must not have NEXT_PUBLIC_ prefix`,
        );
      }
    }
  }

  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const missingOrInvalid = Array.from(
      new Set(result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean)),
    );
    throw new Error(
      `Environment validation failed. Missing or invalid variables: ${missingOrInvalid.join(", ")}`,
    );
  }

  return result.data;
}

let cachedEnv: Env | null = null;

/**
 * Retrieves the validated server environment variables.
 * Lazily evaluated on first access.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Proxy export for ergonomic access to environment variables (`env.OPENAQ_API_KEY`).
 * Enforces lazy validation upon attribute access.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") {
      return undefined;
    }
    const current = getEnv();
    return current[prop as keyof Env];
  },
});
