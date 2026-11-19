import { AdviceResponseSchema, type AdviceResponse } from "@/core/response";
import type { HouseholdProfile, Language } from "@/core/types";
import type { QuestionResponse } from "@/server/pipeline-types";
import type { DraftProfileResult } from "@/server/profile-draft";

export interface GeocodeCandidate {
  label: string;
  lat: number;
  lng: number;
  timezone?: string;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly retryAfterSeconds?: number;

  constructor(opts: {
    message: string;
    code: string;
    httpStatus: number;
    retryAfterSeconds?: number;
  }) {
    super(opts.message);
    this.name = "ApiClientError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

async function handleResponse<T>(res: Response, validate?: (data: unknown) => T): Promise<T> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const rawBody = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const errorObj = rawBody?.error ?? {};
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

    throw new ApiClientError({
      message:
        errorObj.userMessage || errorObj.message || `Request failed with status ${res.status}`,
      code: errorObj.code || (res.status === 429 ? "rate_limited" : "http_error"),
      httpStatus: res.status,
      retryAfterSeconds: isNaN(retryAfterSeconds as number) ? undefined : retryAfterSeconds,
    });
  }

  const payload = rawBody?.data !== undefined ? rawBody.data : rawBody;
  return validate ? validate(payload) : (payload as T);
}

export async function fetchAdvice(
  profile: HouseholdProfile,
  signal?: AbortSignal,
): Promise<AdviceResponse> {
  const res = await fetch("/api/advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
    signal,
  });

  return handleResponse(res, (data) => AdviceResponseSchema.parse(data));
}

export async function fetchExplain(
  profile: HouseholdProfile,
  signal?: AbortSignal,
): Promise<AdviceResponse> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
    signal,
  });

  return handleResponse(res, (data) => AdviceResponseSchema.parse(data));
}

export async function fetchAsk(
  question: string,
  profile: HouseholdProfile,
  history?: Array<{ role: "user" | "assistant"; text: string }>,
  signal?: AbortSignal,
): Promise<QuestionResponse> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile,
      question,
      history,
    }),
    signal,
  });

  return handleResponse<QuestionResponse>(res);
}

export async function fetchGeocode(
  query: string,
  lang?: Language,
  signal?: AbortSignal,
): Promise<GeocodeCandidate[]> {
  const url = `/api/geocode?q=${encodeURIComponent(query.trim())}${lang ? `&lang=${lang}` : ""}`;
  const res = await fetch(url, { signal });
  return handleResponse<{ candidates: GeocodeCandidate[] }>(res).then((d) => d.candidates);
}

export async function fetchParseProfile(
  text: string,
  language: Language = "en",
  signal?: AbortSignal,
): Promise<DraftProfileResult> {
  const res = await fetch("/api/parse-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    signal,
  });

  return handleResponse<DraftProfileResult>(res);
}
