import { describe, expect, it } from "vitest";
import * as envExports from "@/lib/env";
import { validateEnv } from "@/lib/env";

describe("Environment Configuration & Security", () => {
  const validMockEnv = {
    JARVISLABS_API_KEY: "test_jarvislabs_key_12345",
    OPENAQ_API_KEY: "test_openaq_key_67890",
  };

  it("successfully parses valid required env vars and applies safe defaults", () => {
    const config = validateEnv(validMockEnv);
    expect(config.JARVISLABS_API_KEY).toBe("test_jarvislabs_key_12345");
    expect(config.OPENAQ_API_KEY).toBe("test_openaq_key_67890");
    expect(config.JARVISLABS_BASE_URL).toBe("https://models.jarvislabs.net/v1");
    expect(config.JARVISLABS_MODEL).toBe("gemma-4-31b-it");
    expect(config.OPENAQ_RADIUS_KM).toBe(25);
    expect(config.OPENAQ_MAX_AGE_MINUTES).toBe(180);
    expect(config.LLM_MAX_CONCURRENCY).toBe(4);
    expect(config.LLM_TIMEOUT_MS).toBe(15000);
    expect(config.RATE_LIMIT_PER_MINUTE).toBe(20);
    expect(config.NODE_ENV).toBe("development");
  });

  it("boots cleanly with empty environment, using default values and optional API keys", () => {
    const config = validateEnv({});
    expect(config.JARVISLABS_API_KEY).toBe("");
    expect(config.OPENAQ_API_KEY).toBe("");
    expect(config.OPENAQ_RADIUS_KM).toBe(25);
  });

  it("fails fast with an error message listing ONLY invalid variable NAMES, never values", () => {
    const invalidEnv = {
      JARVISLABS_BASE_URL: "not_a_valid_url",
      RATE_LIMIT_PER_MINUTE: -5,
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(
      /Missing or invalid variables: JARVISLABS_BASE_URL, RATE_LIMIT_PER_MINUTE/,
    );

    try {
      validateEnv(invalidEnv);
    } catch (err: unknown) {
      const message = (err as Error).message;
      expect(message).toContain("JARVISLABS_BASE_URL");
      expect(message).toContain("RATE_LIMIT_PER_MINUTE");
      // Must never contain any sensitive or raw values
      expect(message).not.toContain("not_a_valid_url");
    }
  });

  it("prohibits secrets from bearing the NEXT_PUBLIC_ prefix", () => {
    const dangerousEnv = {
      ...validMockEnv,
      NEXT_PUBLIC_OPENAQ_API_KEY: "leaked_secret_val",
    };

    expect(() => validateEnv(dangerousEnv)).toThrowError(
      /Security violation: Secret variable "NEXT_PUBLIC_OPENAQ_API_KEY" must not have NEXT_PUBLIC_ prefix/,
    );
  });

  it("ensures env.ts exports never expose secret values to client code paths", () => {
    const exportedKeys = Object.keys(envExports);

    // No exported symbol or function name may start with NEXT_PUBLIC_
    for (const key of exportedKeys) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
    }

    // Inspect the EnvSchema definition keys to ensure zero NEXT_PUBLIC_ declarations
    const schemaShape = envExports.EnvSchema.shape;
    const schemaKeys = Object.keys(schemaShape);
    for (const schemaKey of schemaKeys) {
      expect(schemaKey.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });
});
