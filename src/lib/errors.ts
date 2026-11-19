/**
 * Base application error class.
 * Ensures all application errors expose a safe user-facing message, an internal code,
 * and an appropriate HTTP status code.
 */
export class AppError extends Error {
  /** Machine-readable error code */
  public readonly code: string;
  /** Safe message intended for user presentation (never leaks internal paths or secrets) */
  public readonly userMessage: string;
  /** HTTP status code mapped to this failure */
  public readonly httpStatus: number;
  /** Optional sanitized internal details for debugging */
  public readonly details?: unknown;

  public constructor(options: {
    message: string;
    code: string;
    userMessage: string;
    httpStatus?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code;
    this.userMessage = options.userMessage;
    this.httpStatus = options.httpStatus ?? 500;
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error raised when input validation fails against domain or API schemas.
 */
export class ValidationError extends AppError {
  public constructor(options: {
    message: string;
    userMessage?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super({
      message: options.message,
      code: "VALIDATION_ERROR",
      userMessage: options.userMessage ?? "The submitted data contains invalid or missing fields.",
      httpStatus: 400,
      details: options.details,
      cause: options.cause,
    });
  }
}

/**
 * Error raised when an external dependency (OpenAQ, Open-Meteo, Jarvis Labs) fails or times out.
 */
export class UpstreamError extends AppError {
  public readonly service: string;

  public constructor(options: {
    service: string;
    message: string;
    userMessage?: string;
    httpStatus?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super({
      message: options.message,
      code: "UPSTREAM_ERROR",
      userMessage:
        options.userMessage ??
        "An upstream data source is currently unavailable. Please try again shortly.",
      httpStatus: options.httpStatus ?? 502,
      details: options.details,
      cause: options.cause,
    });
    this.service = options.service;
  }
}

/**
 * Error raised when a client exceeds allowed request frequency.
 */
export class RateLimitError extends AppError {
  public readonly retryAfterSeconds?: number;

  public constructor(options?: {
    message?: string;
    userMessage?: string;
    retryAfterSeconds?: number;
  }) {
    super({
      message: options?.message ?? "Rate limit exceeded",
      code: "RATE_LIMIT_EXCEEDED",
      userMessage:
        options?.userMessage ?? "Too many requests. Please wait a moment before trying again.",
      httpStatus: 429,
    });
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
