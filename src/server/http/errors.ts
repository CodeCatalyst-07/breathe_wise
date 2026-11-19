import { AppError } from "@/lib/errors";

export class MethodNotAllowedError extends AppError {
  public readonly allowedMethods: readonly string[];

  public constructor(allowedMethods: readonly string[]) {
    super({
      message: `Method not allowed. Allowed methods: ${allowedMethods.join(", ")}`,
      code: "method_not_allowed",
      userMessage: "Method not allowed",
      httpStatus: 405,
    });
    this.allowedMethods = allowedMethods;
  }
}

export class ForbiddenError extends AppError {
  public constructor(message = "Cross-site requests forbidden") {
    super({
      message,
      code: "forbidden",
      userMessage: "Access forbidden",
      httpStatus: 403,
    });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  public constructor(message = "Content-Type must be application/json") {
    super({
      message,
      code: "unsupported_media_type",
      userMessage: message,
      httpStatus: 415,
    });
  }
}

export class PayloadTooLargeError extends AppError {
  public readonly maxBytes: number;

  public constructor(maxBytes: number) {
    super({
      message: `Payload exceeds limit of ${maxBytes} bytes`,
      code: "payload_too_large",
      userMessage: `Payload exceeds maximum permitted size of ${maxBytes} bytes`,
      httpStatus: 413,
    });
    this.maxBytes = maxBytes;
  }
}

export class InvalidJsonError extends AppError {
  public constructor(details?: string) {
    super({
      message: `Invalid JSON payload: ${details ?? "malformed syntax"}`,
      code: "invalid_json",
      userMessage: "Request body contains invalid or malformed JSON",
      httpStatus: 400,
    });
  }
}

export class RequestTimeoutError extends AppError {
  public constructor(timeoutMs: number) {
    super({
      message: `Request timed out after ${timeoutMs}ms`,
      code: "timeout",
      userMessage: "Request processing timed out",
      httpStatus: 504,
    });
  }
}
