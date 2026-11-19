import { describe, expect, it } from "vitest";
import { sanitizeLogData } from "@/lib/logger";

describe("Logger Data Sanitization", () => {
  it("redacts sensitive authentication, token, and secret keys", () => {
    const raw = {
      service: "OpenAQ",
      key: "raw_key_value",
      apiKey: "secret_value_123",
      authorization: "Bearer secret_bearer_token",
      userToken: "token_abc",
      nested: {
        password: "super_secret_pw",
        stationName: "visible_station_name",
      },
    };

    const sanitized = sanitizeLogData(raw) as Record<string, unknown>;

    expect(sanitized["key"]).toBe("[REDACTED]");
    expect(sanitized["apiKey"]).toBe("[REDACTED]");
    expect(sanitized["authorization"]).toBe("[REDACTED]");
    expect(sanitized["userToken"]).toBe("[REDACTED]");
    expect((sanitized["nested"] as Record<string, unknown>)["password"]).toBe("[REDACTED]");
    expect((sanitized["nested"] as Record<string, unknown>)["stationName"]).toBe(
      "visible_station_name",
    );
  });

  it("completely blocks sensitive health, profile, and raw request bodies", () => {
    const rawWithProfile = {
      requestId: "req_12345",
      body: { some: "payload" },
      profile: {
        household: {
          hasRespiratoryCondition: true,
          childrenAgeBands: ["0-2"],
        },
      },
      vulnerability: { asthma: true },
    };

    const sanitized = sanitizeLogData(rawWithProfile) as Record<string, unknown>;

    expect(sanitized["requestId"]).toBe("req_12345");
    expect(sanitized["body"]).toBe("[BLOCKED_PROFILE_OR_BODY]");
    expect(sanitized["profile"]).toBe("[BLOCKED_PROFILE_OR_BODY]");
    expect(sanitized["vulnerability"]).toBe("[BLOCKED_PROFILE_OR_BODY]");
  });

  it("handles circular references gracefully without throwing", () => {
    interface CircularObj {
      name: string;
      self?: CircularObj;
    }
    const circular: CircularObj = { name: "test" };
    circular.self = circular;

    expect(() => sanitizeLogData(circular)).not.toThrow();
    const result = sanitizeLogData(circular) as Record<string, unknown>;
    expect(result["self"]).toBe("[CIRCULAR]");
  });
});
