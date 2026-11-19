import { z } from "zod";
import type { ProviderError, Result } from "../core/ports";
import { err, ok } from "../core/ports";
import { logger } from "../lib/logger";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export interface FetchJsonOptions<T> {
  readonly schema: z.ZodType<T>;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly headers?: Record<string, string>;
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly body?: string;
  readonly fetchFn?: typeof fetch;
  readonly maxBytes?: number;
  readonly sleepFn?: (ms: number) => Promise<void>;
}

export function validateCoordinates(lat: number, lng: number): void {
  if (typeof lat !== "number" || isNaN(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }
  if (typeof lng !== "number" || isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`);
  }
}

export function sanitizeQueryText(text: string, maxLength = 100): string {
  const trimmed = text.trim();
  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }
  return null;
}

function calculateBackoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = parseRetryAfterMs(retryAfterHeader);
  if (retryAfter !== null) return Math.min(retryAfter, 10000);
  const base = 200 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions<T>,
): Promise<Result<T, ProviderError>> {
  const {
    schema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    headers = {},
    method = "GET",
    body,
    fetchFn = fetch,
    maxBytes = DEFAULT_MAX_BYTES,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return err({
      code: "invalid_response",
      message: `Malformed request URL: ${url}`,
      retryable: false,
    });
  }

  const logContext = { method, host: parsedUrl.hostname, path: parsedUrl.pathname };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const response = await fetchFn(url, {
        method,
        headers: { Accept: "application/json", ...headers },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const durationMs = Date.now() - start;
      logger.info("External HTTP request completed", {
        ...logContext,
        status: response.status,
        durationMs,
      });

      if (response.status === 404) {
        return err({
          code: "not_found",
          message: `Resource not found on ${parsedUrl.hostname}`,
          upstreamStatus: 404,
          retryable: false,
        });
      }

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < retries) {
          const backoff = calculateBackoffMs(attempt, response.headers.get("retry-after"));
          await sleepFn(backoff);
          continue;
        }

        const code = response.status === 429 ? "rate_limited" : "upstream_error";
        return err({
          code,
          message: `Upstream HTTP ${response.status} from ${parsedUrl.hostname}`,
          upstreamStatus: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        !contentType.includes("application/json") &&
        !contentType.includes("application/problem+json")
      ) {
        return err({
          code: "invalid_response",
          message: `Expected JSON content-type but received "${contentType}"`,
          upstreamStatus: response.status,
          retryable: false,
        });
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > maxBytes) {
        return err({
          code: "invalid_response",
          message: `Response size exceeds limit of ${maxBytes} bytes`,
          upstreamStatus: response.status,
          retryable: false,
        });
      }

      const text = await response.text();
      if (new TextEncoder().encode(text).length > maxBytes) {
        return err({
          code: "invalid_response",
          message: `Response size exceeds limit of ${maxBytes} bytes`,
          upstreamStatus: response.status,
          retryable: false,
        });
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch (e) {
        return err({
          code: "invalid_response",
          message: "Failed to parse response body as JSON",
          upstreamStatus: response.status,
          retryable: false,
          cause: e,
        });
      }

      const validated = schema.safeParse(parsedJson);
      if (!validated.success) {
        return err({
          code: "invalid_response",
          message: `Upstream payload failed schema validation: ${validated.error.message}`,
          upstreamStatus: response.status,
          retryable: false,
          cause: validated.error,
        });
      }

      return ok(validated.data);
    } catch (error: unknown) {
      clearTimeout(timer);
      const isTimeout = controller.signal.aborted;

      if (attempt < retries) {
        const backoff = calculateBackoffMs(attempt, null);
        await sleepFn(backoff);
        continue;
      }

      if (isTimeout) {
        return err({
          code: "timeout",
          message: `Request to ${parsedUrl.hostname} timed out after ${timeoutMs}ms`,
          retryable: true,
          cause: error,
        });
      }

      return err({
        code: "upstream_error",
        message: `Network request to ${parsedUrl.hostname} failed: ${(error as Error).message}`,
        retryable: true,
        cause: error,
      });
    }
  }

  return err({
    code: "upstream_error",
    message: `Request to ${parsedUrl.hostname} failed after retries`,
    retryable: true,
  });
}
