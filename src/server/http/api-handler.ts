import crypto from "node:crypto";
import type { z } from "zod";
import { getEnv } from "@/lib/env";
import { AppError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { readJsonBodyWithLimit } from "./body-reader";
import {
  ForbiddenError,
  MethodNotAllowedError,
  RequestTimeoutError,
  UnsupportedMediaTypeError,
} from "./errors";
import {
  DEFAULT_BASE_RATE_LIMIT,
  getRateLimiter,
  RateLimiter,
  ROUTE_RATE_LIMITS,
  type RouteRateLimitType,
} from "./rate-limit";

export interface ApiHandlerOptions<TBody> {
  readonly route: string;
  readonly allowedMethods: readonly ("GET" | "POST")[];
  readonly rateLimitType?: RouteRateLimitType;
  readonly maxBodyBytes?: number;
  readonly bodySchema?: z.ZodSchema<TBody>;
  readonly timeoutMs?: number;
  readonly rateLimiter?: RateLimiter;
}

export interface ApiContext<TBody> {
  readonly requestId: string;
  readonly body: TBody;
}

/**
 * Standard API error envelope matching production safety requirements.
 */
export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: unknown;
  };
}

/**
 * Higher-order API route wrapper enforcing security, strict validation, rate limiting,
 * timeouts, log hygiene, and uniform error envelopes.
 */
export function withApi<TBody = undefined, TResponse = unknown>(
  options: ApiHandlerOptions<TBody>,
  handler: (req: Request, ctx: ApiContext<TBody>) => Promise<TResponse>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    let status = 200;

    const baseHeaders: Record<string, string> = {
      "X-Request-Id": requestId,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };

    try {
      // 1. Method Allowlist Check -> 405
      const method = req.method.toUpperCase();
      if (!options.allowedMethods.includes(method as "GET" | "POST")) {
        throw new MethodNotAllowedError(options.allowedMethods);
      }

      // 2. Same-Origin & Cross-Site Protection for state-changing calls -> 403
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const origin = req.headers.get("origin");
        const host = req.headers.get("host");

        if (origin) {
          try {
            const originHost = new URL(origin).host;
            if (host && originHost !== host) {
              throw new ForbiddenError("Cross-origin requests are forbidden");
            }
          } catch {
            throw new ForbiddenError("Malformed Origin header");
          }
        }

        const secFetchSite = req.headers.get("sec-fetch-site");
        if (secFetchSite === "cross-site") {
          throw new ForbiddenError("Cross-site requests are forbidden");
        }
      }

      // 3. Content-Type Check -> 415
      if (options.bodySchema || method === "POST") {
        const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
        if (!contentType.includes("application/json")) {
          throw new UnsupportedMediaTypeError("Content-Type must be application/json");
        }
      }

      // 4. Rate Limiting Check -> 429
      if (options.rateLimitType) {
        let baseRateLimit = DEFAULT_BASE_RATE_LIMIT;
        try {
          baseRateLimit = getEnv().RATE_LIMIT_PER_MINUTE;
        } catch {
          // Fallback to default if env is uninitialized in test
        }

        const limitCalc = ROUTE_RATE_LIMITS[options.rateLimitType];
        const routeLimit = limitCalc(baseRateLimit);

        const xff = req.headers.get("x-forwarded-for");
        const rawIp = xff ? xff.split(",")[0]?.trim() || "unknown" : "unknown";

        const limiter = options.rateLimiter ?? getRateLimiter();
        const clientKey = limiter.hashClientIdentifier(rawIp);
        const rateCheck = limiter.check(clientKey, routeLimit);

        if (!rateCheck.allowed) {
          status = 429;
          const retryAfter = String(rateCheck.retryAfterSeconds ?? 60);
          logger.info("API request completed", {
            requestId,
            route: options.route,
            method: req.method,
            status,
            durationMs: Date.now() - startTime,
          });

          return Response.json(
            {
              error: {
                code: "rate_limited",
                message: "Too many requests. Please wait before retrying.",
                requestId,
              },
            },
            {
              status: 429,
              headers: { ...baseHeaders, "Retry-After": retryAfter },
            },
          );
        }
      }

      // 5. Body Stream Parsing & Zod Validation -> 413, 400
      let parsedBody: TBody = undefined as unknown as TBody;
      if (options.bodySchema) {
        parsedBody = await readJsonBodyWithLimit(
          req,
          options.maxBodyBytes ?? 8192,
          options.bodySchema,
        );
      }

      // 6. Execution with Timeout Guard -> 504
      const timeoutMs = options.timeoutMs ?? 25000;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new RequestTimeoutError(timeoutMs));
        }, timeoutMs);
      });

      const result = await Promise.race([
        handler(req, { requestId, body: parsedBody }),
        timeoutPromise,
      ]);

      if (timer) clearTimeout(timer);

      // 7. Structured Privacy-Safe Log Line
      logger.info("API request completed", {
        requestId,
        route: options.route,
        method: req.method,
        status,
        durationMs: Date.now() - startTime,
      });

      return Response.json(result, { status: 200, headers: baseHeaders });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      let errorStatus = 500;
      let responseHeaders = baseHeaders;
      let envelope: ApiErrorEnvelope = {
        error: {
          code: "internal_error",
          message: "An unexpected error occurred. Please try again later.",
          requestId,
        },
      };

      if (err instanceof MethodNotAllowedError) {
        errorStatus = 405;
        responseHeaders = { ...baseHeaders, Allow: err.allowedMethods.join(", ") };
        envelope = { error: { code: err.code, message: err.userMessage, requestId } };
      } else if (err instanceof AppError) {
        errorStatus = err.httpStatus;
        envelope = {
          error: {
            code: err.code.toLowerCase(),
            message: err.userMessage,
            requestId,
            ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
          },
        };
      }

      logger.info("API request completed", {
        requestId,
        route: options.route,
        method: req.method,
        status: errorStatus,
        durationMs,
      });

      return Response.json(envelope, { status: errorStatus, headers: responseHeaders });
    }
  };
}
