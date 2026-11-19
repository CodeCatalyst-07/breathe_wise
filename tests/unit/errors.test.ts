import { describe, expect, it } from "vitest";
import { AppError, RateLimitError, UpstreamError, ValidationError } from "@/lib/errors";

describe("Application Error Hierarchy", () => {
  it("creates standard AppError with safe userMessage and status code", () => {
    const error = new AppError({
      message: "Internal db connection failed at pool-01",
      code: "DB_CONNECTION_FAIL",
      userMessage: "An internal system error occurred. Please try again.",
      httpStatus: 500,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("DB_CONNECTION_FAIL");
    expect(error.userMessage).toBe("An internal system error occurred. Please try again.");
    expect(error.httpStatus).toBe(500);
    // Safe message does not leak internal connection string or pool info
    expect(error.userMessage).not.toContain("pool-01");
  });

  it("constructs ValidationError with 400 status by default", () => {
    const error = new ValidationError({
      message: "Location latitude 120 is out of bounds",
      details: { field: "location.lat" },
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.httpStatus).toBe(400);
    expect(error.userMessage).toBe("The submitted data contains invalid or missing fields.");
  });

  it("constructs UpstreamError with 502 status and service tag", () => {
    const error = new UpstreamError({
      service: "OpenAQ",
      message: "Upstream gateway timed out after 5000ms",
    });

    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.service).toBe("OpenAQ");
    expect(error.httpStatus).toBe(502);
  });

  it("constructs RateLimitError with 429 status and retry interval", () => {
    const error = new RateLimitError({
      retryAfterSeconds: 60,
    });

    expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(error.httpStatus).toBe(429);
    expect(error.retryAfterSeconds).toBe(60);
  });
});
