/**
 * Sensitive key patterns that must always be redacted in logs.
 * Matches keys such as apiKey, secret_key, key, token, authorization, password, etc.
 */
const SENSITIVE_KEY_REGEX =
  /(?:^|[a-z0-9_-]*(?:api|secret|private|access|auth)[_-]*)key$|^key$|token|auth|bearer|secret|password|credential|cookie/i;

/**
 * Payload keys representing raw request bodies or sensitive personal/health profile data.
 * These are completely masked to protect user privacy.
 */
const BLOCKED_DATA_KEYS = new Set([
  "body",
  "requestbody",
  "profile",
  "household",
  "vulnerability",
  "respiratory",
  "asthma",
  "health",
  "childrenagebands",
]);

/**
 * Sanitizes arbitrary values for safe structured logging.
 * - Recursively traverses plain objects and arrays.
 * - Redacts secrets and authorization headers.
 * - Suppresses user profiles and request bodies entirely.
 *
 * @param data - Target object or primitive to sanitize.
 * @param seen - Circular reference tracking set.
 * @returns Safe representation suitable for serialization.
 */
export function sanitizeLogData(data: unknown, seen = new WeakSet<object>()): unknown {
  if (data === null || typeof data !== "object") {
    return data;
  }

  if (seen.has(data)) {
    return "[CIRCULAR]";
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, seen));
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Completely block payload and sensitive health/profile attributes
    if (BLOCKED_DATA_KEYS.has(lowerKey)) {
      sanitized[key] = "[BLOCKED_PROFILE_OR_BODY]";
      continue;
    }

    // Redact API keys, tokens, auth headers
    if (SENSITIVE_KEY_REGEX.test(lowerKey)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    sanitized[key] = sanitizeLogData(value, seen);
  }

  return sanitized;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: unknown;
}

/**
 * Structured logger that guarantees no secret keys or personal health data are written to log sinks.
 */
export const logger = {
  /**
   * Logs an informational message.
   */
  info(message: string, context?: Record<string, unknown>): void {
    emit("info", message, context);
  },

  /**
   * Logs a warning message.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    emit("warn", message, context);
  },

  /**
   * Logs an error message.
   */
  error(message: string, context?: Record<string, unknown>): void {
    emit("error", message, context);
  },

  /**
   * Logs a debug diagnostic message.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
      emit("debug", message, context);
    }
  },
};

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: sanitizeLogData(context) } : {}),
  };

  const serialized = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    default:
      console.log(serialized);
      break;
  }
}
