# BreatheWise — Urban Air Quality Assistant

## System Architecture & Pipeline

The Urban Air Quality Assistant provides actionable, low-emission daily routines, indoor air quality interventions, and sustainable alternatives during severe winter smog episodes.

---

### Architectural Invariants

1. **Deterministic Core Calculation (Pure & I/O-Free):**
   - The numerical engine (AQI calculations, indoor particulate mass-balance model, intervention impact estimates) is strictly deterministic and free of I/O, network calls, environment variables, or unseeded random state. `buildAdvice` is an asynchronous pipeline orchestrator that performs external cached I/O, then invokes `computeAdviceData`, which is the pure, fast ($<10\text{ ms}$) computational core.
2. **LLM Numbers Guarantee (Explain-Only Principle):**
   - The GenAI assistant (Google Gemma 4 31B IT via Jarvis Labs) **never calculates or invents numerical predictions**. It receives validated, pre-computed `ImpactResult` objects and provides empathetic, clear, context-aware explanations in English or Hindi.
3. **Session-Only Ephemeral Health Context:**
   - Sensitive health attributes (e.g., respiratory conditions like asthma/COPD, presence of infants or elderly) are kept strictly session-only in client memory and request payloads. They are never logged, persisted in databases, or forwarded to third-party tracking.
4. **Hexagonal Architecture (Ports & Adapters):**
   - All external data providers (OpenAQ, Open-Meteo, Jarvis Labs Gemma, Geocoding) are hidden behind abstract TypeScript interfaces (`ports.ts`). Switching or mocking providers requires zero changes to core domain logic.

---

### Pipeline Diagram

```text
+---------------------------------------------------------------------------------+
|                                USER (Desktop / Mobile)                          |
|  - Inputs: Location, Household Demographics, Commute, Home Attributes, Language|
+---------------------------------------------------------------------------------+
                                       |
                                       | HTTPS (Strict CSP, Permissions-Policy)
                                       v
+---------------------------------------------------------------------------------+
|                          Next.js App Router (Server-Side)                       |
|                                                                                 |
|  1. Request Validation (Zod Schemas)                                            |
|  2. Token Bucket / Sliding Window Rate Limiting                                 |
|  3. Safe Structured Logger (Redacts Secrets, Drops Profile/Health Payloads)     |
+---------------------------------------------------------------------------------+
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
         +---------------------------+   +---------------------------+
         |     Air Quality Port      |   |       Weather Port        |
         +---------------------------+   +---------------------------+
                       |                               |
              [OpenAQ / Open-Meteo]             [Open-Meteo / CAMS]
                       |                               |
                       +---------------+---------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                       PURE CORE DOMAIN (Zero I/O, Deterministic)               |
|                                                                                 |
|  - Air Quality & Weather Normalizer                                             |
|  - Indoor Mass Balance & Ventilation Model                                      |
|  - Exposure & Emission Impact Calculator                                        |
|  - Action Candidates & Rules Engine                                             |
|                                                                                 |
|  OUTPUT: Strictly typed, verified `ImpactResult` array                           |
|          (Ensures: deltaLow <= deltaLikely <= deltaHigh)                        |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                              LLM Client Port                                    |
|                   (Google Gemma 4-31B-IT via Jarvis Labs API)                   |
|                                                                                 |
|  Input: Computed ImpactResult + Tone/Language Instructions ("en" | "hi")        |
|  Strict Prompt Constraint: "Never modify numerical figures; explain context."   |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                             CLIENT-SIDE RESPONSE                                |
|  - Clean, accessible UI rendering exact metrics alongside Gemma explanations    |
|  - Full source attribution (OpenAQ, Open-Meteo CAMS ENSEMBLE)                   |
+---------------------------------------------------------------------------------+
```

---

### Component Separation

| Layer           | Responsibility                                                             | Allowed Dependencies         |
| :-------------- | :------------------------------------------------------------------------- | :--------------------------- |
| `src/core/`     | Domain types, Zod schemas, port contracts, deterministic calculations      | None (pure TS / Zod)         |
| `src/adapters/` | Implements ports for external APIs (OpenAQ, Open-Meteo, Jarvis Labs Gemma) | `core/ports.ts`, HTTP client |
| `src/server/`   | API orchestration, rate limiting, in-memory cache, privacy guards          | `core/`, `adapters/`, `lib/` |
| `src/lib/`      | Server-only env loader, error hierarchy, redacting logger, constants       | `server-only`, `zod`         |
| `src/app/`      | Next.js App Router routes, layouts, API endpoints                          | `src/*`                      |

---

### Core Engine Pipeline

The pure core engine executes deterministic calculation and policy decision logic without any I/O:

1. **Parameters & Honesty Guard (`coefficients.ts`)**: Authorised parameters are explicitly tagged with provenance (`"sourced"`, `"assumption"`, `"needs-source"`). Any missing parameter defaults to `null` and restricts the action to qualitative directional output.
2. **Standard Scales (`aqi.ts`)**: Continuous CPCB-style PM2.5 band categorization, WHO 24h exceedance ratio, and linear AQI sub-index calculations.
3. **Physical Mass-Balance Model (`indoor.ts`)**: Steady-state single-compartment model solving $C_{in} = \frac{a \cdot P \cdot C_{out} + S/V}{a + k + \text{CADR}_{eff}/V}$ with guaranteed $low \le likely \le high$ bounds and CADR sizing.
4. **Time-Weighted Integration (`exposure.ts`)**: Integrates non-overlapping microenvironment segments against 24-hour forecasts to compute daily TWA exposure.
5. **Action Evaluation (`actions.ts`, `action-evaluators.ts`)**: Evaluates 9 candidate household and community actions into structured `ImpactResult` objects (numeric, directional, or myth-check).
6. **Policy Rules & Safety Floor (`rules.ts`, `rules-table.ts`)**: Selects prioritized action candidates; vulnerable demographics (infants, elderly, respiratory) monotonically raise urgency and tighten caution. Offline or unavailable sensor data falls back to conservative safety floors without numerical fabrication.
7. **Explainable Ranking (`ranking.ts`)**: Orders candidate actions deterministically by policy priority, numeric impact delta, budget constraints, and stable tie-breaking.
8. **Hallucination Whitelist Guard (`numbers.ts`)**: Whitelists engine-generated figures and normalizes Devanagari numerals to reject fabricated numbers in LLM outputs.

---

### Infrastructure Layer Pipeline (`src/adapters/` & `src/server/`)

1. **Shared HTTP Layer (`http.ts`)**:
   - `fetchJson<T>` with AbortController timeout (default 8s), max 2 retries on 429 and 5xx with exponential backoff and jitter.
   - Respects `Retry-After` headers; caps response payload size (2 MB); verifies `application/json` content types.
   - Validates every upstream payload against strict Zod schemas.
   - SSRF prevention: base URLs are constants; client inputs only enter query strings via `URLSearchParams` after coordinate/length validation.
   - Zero-leak structured logging: logs method, host, path, status, and duration; strips query strings, auth tokens, and response bodies.

2. **Ground & Atmospheric Providers (`openaq.ts`, `open-meteo.ts`, `air-quality-composite.ts`)**:
   - `OpenAqAdapter`: Uses Haversine spherical distance (`geo.ts`) to locate the nearest PM2.5 ground station within radius (`OPENAQ_RADIUS_KM`, default 25 km); rejects stale (>180 min) or implausible readings (>1500 µg/m³).
   - `OpenMeteoAdapter`: CAMS ENSEMBLE atmospheric particulate models (72-hour forecast) and hourly weather forecasts (temperature, humidity, wind, rain).
   - `AirQualityCompositeAdapter`: Concurrent execution via `Promise.allSettled`. Combines fresh OpenAQ ground observations with Open-Meteo forecasts; detects and logs divergence (> 2.0x); provides seamless 4-case fallback matrix.

3. **In-Memory Cache & Single-Flight Deduplication (`cache.ts`)**:
   - TTL caching (OpenAQ: 10m, Open-Meteo AQ: 30m, Weather: 30m, Geocoding: 24h).
   - Coordinate keys rounded to 2 decimal places to deduplicate nearby requests and protect user privacy.
   - LRU eviction (500 items max).
   - Single-flight deduplication tracks in-flight promises to eliminate redundant upstream calls.
   - Serve-stale-on-error support up to 2x TTL keeps the application resilient during upstream outages.

4. **GenAI Language Client (`jarvislabs-gemma.ts`)**:
   - OpenAI-compatible completion client pinned to Google Gemma (`gemma-4-31b-it`).
   - Empirical flags: `chat_template_kwargs: { enable_thinking: false }`, `max_tokens >= 2500`, raw markdown JSON parsing.
   - Semaphore concurrency limiter (`LLM_MAX_CONCURRENCY`, default 4).
   - Prompt injection immunity: untrusted user profile text is wrapped in `<user_input>` delimiters and capped at 500 characters.
   - Automatic single repair retry on length limit or malformed JSON.

---

### Orchestration & Multi-Stage Safety Pipeline (`src/server/`)

The server pipeline (`src/server/pipeline.ts`) provides three distinct operational paths:

```text
+----------------------------------------------------------------------------------------------------+
|                                    ORCHESTRATION PIPELINE                                          |
+----------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                      |                                      |
           v                                      v                                      v
  [1. FAST PATH: buildAdvice]         [2. EXPLAIN PATH: explainAdvice]      [3. ASSISTANT: answerQuestion]
           |                                      |                                      |
  1. Validate Input (Zod)                1. Call computeAdviceData              1. Recompute Advice Server-Side
  2. Parallel Fetch (Cached AQ/Wx)       2. Privacy Payload to LLM              2. Build Grounding Context
  3. Estimate Indoor Concentration          (No coords, ages, or raw profile)   3. XML Quarantine Question (<300 chars)
  4. Evaluate Actions & Policy Floor     3. LLM GenAI Inference Call            4. Max 3 Prior Turns Quarantined
  5. Deterministic Action Ranking        4. Ordered Safety Guards:              5. LLM Answer Inference Call
  6. Plan 24h DayPlan & Outlook             a. Zod Schema Validation            6. Ordered Safety Guards:
  7. Plan Google Calendar Events            b. Number Whitelist Guard              a. Zod/Type Validation
  8. Build Builtin Explanations                (findDisallowedNumbers)             b. Number Whitelist Guard
  9. Assemble AdviceResponse (NO LLM)          (1 Retry -> Builtin Fallback)          (1 Retry -> Builtin Fallback)
           |                                c. Safety Content Filter               c. Safety Content Filter
           v                                   (checkSafety: Medical/Claims)          (checkSafety: Medical/Claims)
     [AdviceResponse]                       d. General Disclaimers Attached     7. Return Verified Response
                                                    |                                    |
                                                    v                                    v
                                            [AdviceResponse + AI]               [QuestionResponse]
```

#### Ordered Safety Guard Sequence:

1. **Zod Validation**: Validates completion schema against typed structured response models.
2. **Number Whitelist Guard (`findDisallowedNumbers`)**: Extracts all numerals in the text and ensures every number belongs to the set of authorized outputs produced by the core engine (calculated deltas, baselines, observed concentrations, WHO 15 µg/m³ threshold, local hours 0-24, and counts). If unauthorized numbers are detected, one regeneration retry is dispatched with the offending tokens listed (never user data). If it fails a second time, the system falls back to built-in deterministic explanations (`source: "builtin"`).
3. **Clinical Safety & Medical Advice Filter (`checkSafety`)**: Rejects generations containing clinical diagnoses, pharmaceutical dosage/medication instructions, cure/prevention promises, or absolute "100% safe" claims across English and Hindi patterns. Any violation triggers immediate fallback to built-in guidance (`source: "builtin"`).
4. **Disclaimers**: Every response carries standard exposure reduction engineering disclaimers and immediate symptom alerts.

---

### HTTP API Architecture (`src/server/http/`)

All HTTP endpoints are protected by the `withApi` wrapper in `src/server/http/api-handler.ts`, enforcing:

- **Streaming Body Reading**: Strictly limited to 8 KB (`PayloadTooLargeError` $\to$ 413) without trusting `Content-Length`.
- **Method Allowlist**: Rejects unexpected verbs with 405 Method Not Allowed and the `Allow` header.
- **Strict Same-Origin Checks**: Rejects cross-site fetch calls (`Sec-Fetch-Site: cross-site`) with 403 Forbidden. No wildcard CORS or `Access-Control-*` headers are exposed.
- **Strict Zod Parsing**: Rejects unknown JSON fields. Never echoes submitted values in validation errors.
- **Sliding-Window Rate Limiting**: Salts and hashes client IP addresses with SHA-256 in process memory, returning 429 with `Retry-After`.
- **Log Hygiene**: Emits a structured log line per request containing only `requestId`, `route`, `method`, `status`, and `durationMs`. Never logs request bodies, profiles, coordinates, questions, or raw IPs.
