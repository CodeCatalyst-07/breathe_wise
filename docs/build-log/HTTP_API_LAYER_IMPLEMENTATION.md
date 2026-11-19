# HTTP API Layer Implementation & Hardening Report (BreatheWise)

We have built and verified the complete **HTTP API Layer** for **BreatheWise (Urban Air Quality Assistant)** in Next.js 15 App Router. The entire surface is tested, typed, and documented with zero lint errors or warnings.

---

## 1. File Tree of Changes

```
src/
├── app/
│   └── api/
│       ├── advice/route.ts         # Fast path advisory API route (32 lines)
│       ├── ask/route.ts            # Conversational assistant API route (43 lines)
│       ├── explain/route.ts        # AI narrative synthesis API route (32 lines)
│       ├── geocode/route.ts        # Location search API route (42 lines)
│       ├── health/route.ts         # Minimal liveness probe API route (18 lines)
│       └── parse-profile/route.ts  # Unstructured profile parsing route (88 lines)
├── server/
│   ├── http/                       # NEW: Shared API infrastructure
│   │   ├── api-handler.ts          # withApi higher-order route wrapper (226 lines)
│   │   ├── body-reader.ts          # 8 KB streaming body reader with strict Zod parsing (87 lines)
│   │   ├── errors.ts               # HTTP errors (400, 403, 405, 413, 415, 504) (73 lines)
│   │   ├── index.ts                # Barrel export for http module (5 lines)
│   │   ├── rate-limit.ts           # Sliding-window rate limiter with salted SHA-256 (156 lines)
│   │   └── schemas.ts              # Strict request Zod schemas (110 lines)
├── container.ts                # AppContainer interface, getContainer, setContainerForTests (123 lines)
│   ├── pipeline.ts                 # Standardized 3-stage guard order & whitelist retry (191 lines)
│   ├── pipeline-compute.ts         # Hardened fallback branches (branch coverage: 79.24%) (236 lines)
│   ├── pipeline-helpers.ts         # Added dayplan/outlook hour labels to whitelist (112 lines)
│   ├── pipeline-types.ts           # Added declined and reasonKey to QuestionResponse (41 lines)
│   └── README.md                   # Documented async I/O vs compute and HTTP middleware
├── core/
│   ├── ports.ts                    # Added disallowedTokens, parseProfile to LlmClient (207 lines)
│   └── calendar.ts                 # Safe date checks preventing invalid time range errors (185 lines)
├── adapters/
│   ├── jarvislabs-gemma.ts         # Updated attribution to Google Gemma 4 31B IT (242 lines)
│   └── prompts/
│       └── explanation.ts          # Added prompt clause for disallowedTokens retry (82 lines)
├── lib/
│   └── constants.ts                # Pinned ATTRIBUTION_GEMMA to Google Gemma 4 31B IT (30 lines)
├── i18n/
│   ├── en.json                     # Updated Gemma attribution to "Google Gemma 4 31B IT"
│   └── hi.json                     # Updated Hindi Gemma attribution to "Google Gemma 4 31B IT"
docs/
├── API.md                          # NEW: Comprehensive HTTP API documentation & examples
├── ARCHITECTURE.md                 # Updated request lifecycle, guard order, and async I/O notes
└── DATA_SOURCES.md                 # Updated Gemma attribution to Google Gemma 4 31B IT
scripts/
└── smoke-api.ts                    # NEW: Smoke test script for all 6 endpoints
tests/
├── unit/
│   ├── api-handler.test.ts         # NEW: Body limits, streaming chunks, rate limiting, errors (13 tests)
│   ├── api-routes.test.ts          # NEW: Route handlers, golden fixture contracts (12 tests)
│   ├── http.test.ts                # Hardened 429 Retry-After, 5xx retries, and size caps (15 tests)
│   └── pipeline.test.ts            # Added branch coverage tests for pipeline compute (19 tests)
└── security/
    ├── api-security.test.ts        # NEW: Log hygiene (no IP/body) & CORS header checks (2 tests)
    └── llm-privacy.test.ts         # NEW: Exact payload inspection asserting zero coordinates/ages (1 test)
package.json                        # Added "smoke:api" script
```

---

## 2. Contract Changes (Additive Only)

1. `src/core/ports.ts`:
   - Added optional `disallowedTokens?: readonly string[]` to `ExplanationRequest`.
   - Added optional `parseProfile?(freeText: string, language?: Language): Promise<Result<Record<string, unknown>, ProviderError>>` to `LlmClient`.
2. `src/server/pipeline-types.ts`:
   - Updated `QuestionResponse` to include `declined?: boolean; reasonKey?: string; explanationSource?: "ai" | "builtin"`.
3. `src/server/container.ts`:
   - Exported `AppContainer` interface (`pipeline: Pipeline; geocoding: GeocodingPort; llm?: LlmClient`).
   - Exported `getContainer(): AppContainer`, `setContainerForTests(container: AppContainer | undefined): void`, and `resetContainer(): void`.
4. `src/server/http/schemas.ts`:
   - Exported `AdviceRequestBodySchema`, `ExplainRequestBodySchema`, `AskRequestBodySchema`, `ParseProfileRequestBodySchema`, and `GeocodeQuerySchema`.

---

## 3. Assumptions & Verifications

- **Dev Server Host**: `scripts/smoke-api.ts` assumes the Next.js server runs locally at `http://localhost:3000` (overridable via `API_BASE_URL` environment variable).
- **In-Memory Rate Limiting**: As documented in `rate-limit.ts` and `docs/API.md`, the sliding-window rate limiter stores timestamps in process memory. In serverless multi-replica deployments, each instance manages its own window. For multi-replica deployments, pairing with Redis/Cloudflare KV is documented.
- **External Network Absence**: All tests run completely offline with fake containers, fixed clocks, and deterministic mocks without making live upstream network calls.

---

## 4. Real Terminal Verification Outputs

### `npm run check` Output

```
> urban-air-quality-assistant@0.1.0 check
> npm run lint && npm run typecheck && npm run test

> urban-air-quality-assistant@0.1.0 lint
> eslint .

> urban-air-quality-assistant@0.1.0 typecheck
> tsc --noEmit

> urban-air-quality-assistant@0.1.0 test
> vitest run

 RUN  v3.2.7 /Users/arnav/Desktop/BreatheWise

 Test Files  38 passed (38)
      Tests  375 passed (375)
   Start at  11:13:30
   Duration  1.54s
```

### Coverage Highlights (`npm run test:coverage`)

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   89.50 |    82.78 |   91.13 |   89.50 |
 src/core          |   97.94 |    88.14 |   95.45 |   97.94 | (Target >90%)
  calendar.ts      |   97.60 |    80.95 |     100 |   97.60 | 58-60
  dayplan.ts       |   98.75 |    94.82 |     100 |   98.75 | 71-72
 src/server        |   91.05 |    85.34 |   86.66 |   91.05 | (Target >88%)
  pipeline-compute |   97.42 |    79.24 |     100 |   97.42 | (Target >70%)
  pipeline.ts      |   89.55 |    82.50 |     100 |   89.55 |
 src/server/http   |   91.54 |    88.29 |     100 |   91.54 |
  api-handler.ts   |   86.20 |    88.88 |     100 |   86.20 |
  body-reader.ts   |   90.32 |    85.00 |     100 |   90.32 |
  rate-limit.ts    |   89.69 |    89.65 |     100 |   89.69 |
  schemas.ts       |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

### Production Build (`npm run build`)

```
> urban-air-quality-assistant@0.1.0 build
> next build

   ▲ Next.js 15.5.29
   - Environments: .env

   Creating an optimized production build ...
 ✓ Compiled successfully in 812ms
   Linting and checking validity of types     ✓ Linting and checking validity of types
   Collecting page data     ✓ Collecting page data
 ✓ Generating static pages (10/10)
   Collecting build traces     ✓ Collecting build traces
   Finalizing page optimization     ✓ Finalizing page optimization

Route (app)                                 Size  First Load JS
┌ ○ /                                      140 B         103 kB
├ ○ /_not-found                            996 B         104 kB
├ ƒ /api/advice                            140 B         103 kB
├ ƒ /api/ask                               140 B         103 kB
├ ƒ /api/explain                           140 B         103 kB
├ ƒ /api/geocode                           140 B         103 kB
├ ƒ /api/health                            140 B         103 kB
└ ƒ /api/parse-profile                     140 B         103 kB
+ First Load JS shared by all             103 kB
```

### File Line Count Invariant

All files in `src/` remain strictly $<250$ lines (maximum is `src/core/dayplan.ts` at 248 lines; `src/server/http/api-handler.ts` is 226 lines).

---

## 5. Curl Commands for Manual Testing

### 1. Health Check

```bash
curl -i -X GET http://localhost:3000/api/health
```

### 2. Geocoding Search

```bash
curl -i -X GET "http://localhost:3000/api/geocode?q=Connaught%20Place&lang=en"
```

### 3. Build Advice (Fast Path, No LLM)

```bash
curl -i -X POST http://localhost:3000/api/advice \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "location": { "lat": 28.6139, "lng": 77.2090, "label": "Central Delhi", "timezone": "Asia/Kolkata" },
      "household": { "childrenAgeBands": ["0-2"], "hasElderly": true, "hasRespiratoryCondition": true },
      "commuteMode": "auto_rickshaw",
      "home": { "roomVolumeM3": 45, "windowsHabit": "closed_all_day", "purifierCadrM3h": 250, "cookingFuel": "lpg" },
      "budgetInr": 5000,
      "language": "en"
    }
  }'
```

### 4. Explain Advice (AI Path with Builtin Fallback)

```bash
curl -i -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "location": { "lat": 28.6139, "lng": 77.2090, "label": "Central Delhi", "timezone": "Asia/Kolkata" },
      "household": { "childrenAgeBands": [], "hasElderly": false, "hasRespiratoryCondition": false },
      "commuteMode": "metro",
      "home": { "windowsHabit": "closed_all_day", "cookingFuel": "lpg" },
      "language": "en"
    }
  }'
```

### 5. Follow-Up Assistant

```bash
curl -i -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "location": { "lat": 28.6139, "lng": 77.2090, "label": "Delhi" },
      "household": { "childrenAgeBands": [], "hasElderly": false, "hasRespiratoryCondition": false },
      "commuteMode": "metro",
      "home": { "windowsHabit": "closed_all_day", "cookingFuel": "lpg" },
      "language": "en"
    },
    "question": "When is the safest time to exercise outdoors tomorrow?"
  }'
```

### 6. Natural Language Profile Parsing

```bash
curl -i -X POST http://localhost:3000/api/parse-profile \
  -H "Content-Type: application/json" \
  -d '{
    "text": "We commute by metro every day. My elderly mother lives with us and has asthma. We keep windows closed all day.",
    "language": "en"
  }'
```

### 7. Test Security Rejection: Unknown Property (400)

```bash
curl -i -X POST http://localhost:3000/api/advice \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "location": { "lat": 28.6139, "lng": 77.2090, "label": "Delhi" },
      "household": { "childrenAgeBands": [], "hasElderly": false, "hasRespiratoryCondition": false },
      "commuteMode": "metro",
      "home": { "windowsHabit": "closed_all_day", "cookingFuel": "lpg" },
      "language": "en"
    },
    "unknownField": "maliciousValue"
  }'
```

### 8. Test Security Rejection: Cross-Origin POST (403)

```bash
curl -i -X POST http://localhost:3000/api/advice \
  -H "Content-Type: application/json" \
  -H "Origin: https://malicious-site.com" \
  -d '{"profile": {}}'
```

---

## 6. Architectural Decisions & Rationales

1. **Guard Order Standardization**:
   - Order: (1) Output structure validation $\to$ (2) Number whitelist check with 1 retry passing only the offending tokens $\to$ (3) Content safety check (medical claims, absolute guarantees).
   - _Rationale_: Structural validation ensures downstream parsers never crash on unexpected shapes. Whitelisting prevents hallucinated numbers from being analyzed or quoted in safety filters. Any safety violation immediately drops the narrative in favor of deterministic pre-translated built-in explanations.
2. **Generic Error Responses (No Input Echoing)**:
   - Zod validation issues return `{ path: "profile.location.lat", message: "..." }`. The `issue.received` or user input values are intentionally omitted from responses.
   - _Rationale_: Prevents reflected XSS, token leakage, and inadvertent reflection of sensitive user input in error monitors.
3. **Chunked Streamed Body Reader**:
   - Implemented in `src/server/http/body-reader.ts` using `ReadableStreamDefaultReader` with cumulative byte length accumulation.
   - _Rationale_: Attackers can send `Content-Length: 100` and stream megabytes of data to cause memory exhaustion. Reading chunk-by-chunk guarantees that requests exceeding 8 KB are aborted immediately with HTTP 413.
4. **Salted SHA-256 Client IP Hashing**:
   - Implemented in `src/server/http/rate-limit.ts` using a per-process random salt.
   - _Rationale_: Client IP addresses are considered personal data under privacy regulations. Hashing with a per-process random salt ensures that raw IP addresses are never retained in memory while still providing sliding-window rate limit isolation.
