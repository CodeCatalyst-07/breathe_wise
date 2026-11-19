# Orchestration and Safety Layer Implementation Summary (BreatheWise)

## 1. Executive Summary

In this phase, we completed the **Orchestration and Safety Layer** of **BreatheWise (Urban Air Quality Assistant)**. The platform unites pure scientific core modeling, resilient external data adapters, and an AI advisory pipeline protected by strict deterministic safety filters and number whitelisting guards.

### Key Highlights:

- **Zero Scientific Numbers Invented**: All model parameters reside in `src/core/coefficients.ts`. All UX thresholds are isolated in `src/core/heuristics.ts` tagged `"heuristic - not scientific"`. All health advice rules are tagged `"policy - to be reviewed"`.
- **Three-Tier Execution Pipeline**:
  1. `buildAdvice`: Fast, synchronous path ($<10\text{ ms}$) executing pure deterministic calculations, AQI categorizations, indoor modeling, action ranking, and 24-hour day planning without invoking an LLM.
  2. `explainAdvice`: Async path invoking Google Gemma 2 (via Jarvis Labs) to generate natural language explanations. Guarded by a strict 4-stage pipeline (Content Safety $\to$ Number Whitelist $\to$ Fallback on failure).
  3. `answerQuestion`: Assistant follow-up path with recomputed scientific grounding, XML quarantined user prompt injection (`<user_question>`, `<prior_conversation>`), and safety filters.
- **Geocoding Fix & Upstream Parity**: Diagnosed and resolved the Open-Meteo Geocoding 0-candidates issue by handling optional/null administrative fields, adding multi-segment query fallback, and querying IANA timezones.
- **Privacy First**: Health context (vulnerabilities) and exact GPS coordinates are **never** logged, persisted, or passed to external LLMs. Google Calendar URLs contain zero PII or coordinates.
- **Strict Code Metrics**:
  - `npm run check` (`lint`, `typecheck`, `test`): **0 errors, 0 warnings**.
  - **34 test files, 337 tests passed (100%)**.
  - `src/core/` line coverage: **97.84%** (Target: $>90\%$).
  - `src/server/` line coverage: **91.60%** (Target: $>85\%$).
  - `src/adapters/` line coverage: **85.97%**.
  - **Every file in `src/` is strictly $<250$ lines** (longest file is `dayplan.ts` at 248 lines).

---

## 2. File Tree of Changes

```
src/
├── core/
│   ├── heuristics.ts            # NEW: UX thresholds tagged "heuristic - not scientific" (59 lines)
│   ├── dayplan.ts               # NEW: 24h routine planning, ventilation windows, policy table (248 lines)
│   ├── outlook.ts               # NEW: 12h vs 12h forecast comparison (108 lines)
│   ├── calendar.ts              # NEW: Google Calendar TEMPLATE URL generator (182 lines)
│   ├── explain-builtin.ts       # NEW: Deterministic key-driven structured explanations (105 lines)
│   ├── response.ts              # NEW: AdviceResponseSchema and Zod output contracts (144 lines)
│   ├── actions.ts               # MODIFIED: Added 3 community actions (189 lines)
│   ├── coefficients.ts          # MODIFIED: Added community action coefficients (227 lines)
│   ├── ports.ts                 # MODIFIED: Added aliases and answer() interface (194 lines)
│   ├── types.ts                 # MODIFIED: Added divergence to AirQualitySnapshot (244 lines)
│   └── index.ts                 # MODIFIED: Re-exported all new domain modules (16 lines)
├── server/
│   ├── safety.ts                # NEW: Content safety filter (medical/claim check, Hindi regex) (85 lines)
│   ├── pipeline-types.ts        # NEW: Pipeline dependency and request/response interfaces (39 lines)
│   ├── pipeline-helpers.ts      # NEW: Grounding builders and whitelist aggregators (108 lines)
│   ├── pipeline-compute.ts      # NEW: Pure compute orchestration & fallback matrix (236 lines)
│   ├── pipeline.ts              # NEW: Orchestrator for buildAdvice, explainAdvice, answerQuestion (146 lines)
│   ├── cached-adapters.ts       # NEW: Cached wrappers for AQ, Weather, Geocoding (86 lines)
│   ├── container.ts             # NEW: Lazy composition root wiring cached ports from env (88 lines)
│   ├── index.ts                 # NEW: Re-exported server orchestration (8 lines)
│   └── README.md                # NEW: Pipeline architecture and safety documentation
├── adapters/
│   ├── geocoding.ts             # MODIFIED: Fixed 0-candidates bug, added timezone & fallback (144 lines)
│   ├── jarvislabs-gemma.ts      # MODIFIED: Implemented answer() method, removed whitelist (242 lines)
│   ├── air-quality-composite.ts # MODIFIED: Exposed divergence ratio and boolean flag (130 lines)
│   └── prompts/
│       └── ask.ts               # NEW: Quarantined XML prompt for follow-up questions (74 lines)
├── i18n/
│   └── en.json                  # MODIFIED: Added community action, dayplan & explanation keys
docs/
├── ARCHITECTURE.md              # MODIFIED: Added pipeline flow, guard sequence, and invariants
└── DATA_SOURCES.md             # MODIFIED: Documented Open-Meteo model resolution as "coarse, tens of km"
tests/
├── unit/
│   ├── ask-prompt.test.ts       # NEW: XML quarantine and injection tests
│   ├── calendar.test.ts         # NEW: Google Calendar URL structure and privacy tests
│   ├── container.test.ts        # NEW: Dependency injection and caching verification
│   ├── dayplan.test.ts          # NEW: 24h routine planning and policy matrix tests
│   ├── explain-builtin.test.ts  # NEW: Builtin explanation deterministic output tests
│   ├── geocoding.test.ts        # MODIFIED: Added regression tests for Open-Meteo geocoding
│   ├── outlook.test.ts          # NEW: Trend analysis and edge case tests
│   ├── pipeline.test.ts         # NEW: 14 comprehensive tests for fast, AI, and question paths
│   └── safety.test.ts           # NEW: Medical diagnosis, medication, and claim rejection tests
```

---

## 3. Geocoding Fix & Regression Verification

### Issue Analysis

During the initial live smoke test, geocoding queries for cities like `"Delhi, India"` returned 0 candidates.

1. **Schema Mismatch**: Open-Meteo's geocoding endpoint occasionally returns `null` or omits `admin1`, `country`, and `postcodes` for certain geographic entities. The strict Zod schema failed parsing or rejected records.
2. **Multi-segment Query Sensitivity**: Open-Meteo geocoding performs exact substring prefix matching. Compound search strings like `"South Delhi, Delhi, India"` or `"New Delhi, India"` failed on the upstream search index.

### Solution Implemented in `src/adapters/geocoding.ts`

1. **Nullish Schema Parsing**:
   ```typescript
   admin1: z.string().nullish(),
   country: z.string().nullish(),
   country_code: z.string().nullish(),
   timezone: z.string().nullish(),
   ```
2. **Multi-Segment Search Fallback**:
   If a qualified multi-comma query (e.g., `"South Delhi, India"`) returns 0 results, the adapter splits the query by commas, extracts the primary city segment (`"South Delhi"` or `"Delhi"`), and retries transparently.
3. **IANA Timezone Extraction**:
   Included `timezone` in query results so that local calendar events and hourly dayplans use the true local timezone (e.g., `Asia/Kolkata`).

### Regression Tests

Verified in `tests/unit/geocoding.test.ts`:

- Resolves known city `'Delhi'` with nullish admin/country fields.
- Falls back to city segment when qualified query returns 0 candidates.
- Caps candidates at `DEFAULT_GEOCODING_LIMIT` (5) and rounds coordinates to 4 decimal places.

---

## 4. Step 0 Review Fixes

1. **Air Quality Divergence Exposed**:
   - `AirQualitySnapshot` now includes:
     ```typescript
     divergence?: {
       ratio: number;
       isDivergent: boolean;
     };
     ```
   - Computed in `src/adapters/air-quality-composite.ts` when both OpenAQ ground sensors and Open-Meteo atmospheric models are available.
2. **Explicit Wind Speed Units**:
   - Weather queries explicitly request `wind_speed_10m` in `m/s` from Open-Meteo. Documented in types and verified in contract tests.
3. **IANA Timezone Propagation**:
   - `GeocodingPort` and `WeatherPort` return the IANA timezone string (`timezone=auto`) to power `dayplan.ts` and `calendar.ts`.
4. **Number Whitelist Guard Placement**:
   - Removed `collectAllowedNumbers` from `src/adapters/jarvislabs-gemma.ts` (transport layer).
   - Placed exclusively in `src/server/pipeline.ts` as Stage 2 of LLM response validation.
5. **Data Sources Documentation**:
   - Updated `docs/DATA_SOURCES.md` to describe atmospheric CAMS/Open-Meteo model resolution as _"coarse, tens of kilometres"_.

---

## 5. Core Additions (`src/core/`)

### A. UX Heuristics (`src/core/heuristics.ts`)

All thresholds that are UX choices rather than scientific facts are isolated and tagged `"heuristic - not scientific"`:

- `OUTLOOK_DIFF_THRESHOLD_UG_M3 = 15`: Minimum PM2.5 difference between 12h windows to report an "improving" or "worsening" trend.
- `VENTILATION_SAFETY_MARGIN_UG_M3 = 5`: Buffer between outdoor PM2.5 and indoor concentration required to recommend opening windows.
- `CALENDAR_MAX_EVENTS = 3`: Maximum actionable calendar reminders suggested per day.
- `CALENDAR_EVENT_DURATION_MINUTES = 60`: Default duration for routine events.
- `AIR_QUALITY_DIVERGENCE_RATIO_THRESHOLD = 2.0`: Ratio threshold between ground station and atmospheric model to flag divergence.

### B. Community Actions (`src/core/actions.ts` & `src/core/coefficients.ts`)

Added 3 non-individual actions tailored for winter smog mitigation:

1. `shared_clean_air_room_for_building`: Setting up a shared filtered community space in apartment basements or common rooms.
2. `reduce_vehicle_idling_at_school_gates`: School anti-idling campaigns during drop-off/pick-up hours.
3. `organise_carpool_or_shared_transport`: Collective commuting to reduce vehicular emission density.
   All 3 actions are tagged `status: "needs-source"`, returning `displayMode: "directional"` without inventing quantitative reduction deltas.

### C. 24-Hour Day Plan (`src/core/dayplan.ts`)

- Pure function `planDay(input)` producing 24 hourly activity slots.
- **Activity Guidance**:
  - `ok`: Concentration $\le 60\ \mu\text{g/m}^3$ (Satisfactory).
  - `limit`: Concentration $61 - 120\ \mu\text{g/m}^3$ (Moderate/Poor).
  - `avoid`: Concentration $> 120\ \mu\text{g/m}^3$ (Very Poor/Severe).
  - Strict policy matrix applies stricter thresholds (`avoid` at $>60\ \mu\text{g/m}^3$) for vulnerable households (children, elderly, asthma).
- **Ventilation Windows**: Recommended only when outdoor PM2.5 is lower than estimated indoor PM2.5 minus safety margin AND outdoor category is not Very Poor or Severe.

### D. 24-Hour Outlook (`src/core/outlook.ts`)

- Compares mean PM2.5 of next 12 hours ($T_{0..11}$) against following 12 hours ($T_{12..23}$).
- Categorizes trend as `improving`, `worsening`, or `stable` based on `OUTLOOK_DIFF_THRESHOLD_UG_M3`.
- Returns summary key, peak hour, minimum hour, and expected range.

### E. Google Calendar URL Generator (`src/core/calendar.ts`)

- Pure template URL generator using `https://calendar.google.com/calendar/render?action=TEMPLATE`.
- Zero PII: Titles and descriptions use sanitized strings; coordinates, addresses, and medical profiles are excluded.
- Produces events for:
  1. _Best Ventilation Window_ (opening windows when outdoor air cleans indoor air).
  2. _Low-Exposure Outdoor Window_ (safest time for necessary errands).
  3. _High Smog Peak Warning_ (reminder to seal windows and run indoor air cleaning).

### F. Deterministic Built-in Explanations (`src/core/explain-builtin.ts`)

- Generates structured, localized explanation keys and parameters without requiring an LLM.
- Guarantees instant, zero-cost, offline fallback for all advice.

---

## 6. Server Orchestration & Safety Layer (`src/server/`)

### A. Content Safety Filter (`src/server/safety.ts`)

Evaluates user queries and LLM generated responses against strict safety boundaries:

1. **Medical Diagnosis**: Detects claims diagnosing asthma, bronchitis, COPD, or lung conditions.
2. **Medication & Dosage**: Flags drug names, dosage recommendations, steroids, or inhaler changes (English & Devanagari Hindi script support: `दवा`, `खुराक`, `गोली`, `इनहेलर`).
3. **Cure & Prevention Guarantees**: Flags promises that an action will "cure", "prevent illness", or "completely eliminate health risk".
4. **Absolute Safety Claims**: Flags phrases like "air is 100% safe", "zero risk", or "completely harmless".

### B. Pipeline Architecture (`src/server/pipeline.ts`)

The `Pipeline` class coordinates data fetching, core evaluation, safety enforcement, and LLM communication:

```mermaid
flowchart TD
    Req[Advice Request: Location + Profile] --> Fetch[Cached Adapters: AQ + Weather]
    Fetch --> Compute[Pure Core Engine: indoor, dayplan, actions, ranking]
    Compute --> FastResponse[AdviceResponse: Numbers, Windows, Built-in Keys]

    FastResponse --> LLM{LLM Enabled?}
    LLM -- No --> Done[Return Fast Path Response]
    LLM -- Yes --> Stage1[Gemma LLM Inference]

    Stage1 --> Stage2[Safety Filter: Medical & Absolute Claims]
    Stage2 -- Violation --> Fallback[Fallback to Built-in Explanation]
    Stage2 -- Pass --> Stage3[Number Whitelist Guard]
    Stage3 -- Disallowed Number --> Fallback
    Stage3 -- Pass --> Stage4[Zod Schema Validation]
    Stage4 -- Pass --> AIResponse[AdviceResponse with Verified AI Narrative]
```

### C. Follow-Up Assistant (`answerQuestion`)

- Quarantines user input inside `<user_question>` tags in `src/adapters/prompts/ask.ts`.
- Quarantines conversation context inside `<prior_conversation>` tags.
- Injects recomputed scientific grounding (current AQI, indoor estimate, top actions).
- Declines off-topic, medical, or diagnostic questions deterministically.

### D. Cached Adapters & Composition Root (`src/server/container.ts`)

- Decorates `AirQualityPort`, `WeatherPort`, and `GeocodingPort` with `InMemoryCache`.
- Provides TTL-based caching and stale-while-revalidate error tolerance.
- Composition root lazily instantiates dependencies from `getEnv()`.

---

## 7. Verification & Test Metrics

### `npm run check` Terminal Output

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

 Test Files  34 passed (34)
      Tests  337 passed (337)
   Start at  10:47:52
   Duration  1.34s (transform 597ms, setup 0ms, collect 1.96s, tests 321ms, environment 3ms, prepare 1.64s)
```

### Coverage Table (`npm run test:coverage`)

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   89.17 |    81.65 |   90.66 |   89.17 |
 src/adapters      |   85.97 |    77.22 |   97.22 |   85.97 |
  air-quality-comp |   88.76 |       80 |     100 |   88.76 | 50-54,59-63
  geocoding.ts     |   94.23 |    78.26 |     100 |   94.23 | 98-99,117-119
  http.ts          |   73.68 |    84.78 |   85.71 |   73.68 | 175-182,197-221
  jarvislabs-gemma |   89.58 |       70 |     100 |   89.58 | 190-195,218-223
  open-meteo.ts    |   94.77 |    67.74 |     100 |   94.77 | 150-151,171-172
  openaq.ts        |    81.5 |    80.95 |     100 |    81.5 | 183-205,208-213
 src/adapters/prompts 97.63  |    47.36 |     100 |   97.63 |
  ask.ts           |      96 |    85.71 |     100 |      96 | 28
  explanation.ts   |   98.38 |       20 |     100 |   98.38 | 33
  profile-parser   |    97.5 |       50 |     100 |    97.5 | 33
 src/core          |   97.84 |    87.28 |   95.45 |   97.84 |
  action-evaluators|   97.86 |    87.17 |     100 |   97.86 | 34-35,48-49
  actions.ts       |     100 |      100 |   85.71 |     100 |
  aqi.ts           |   95.71 |    86.84 |     100 |   95.71 | 196-197,200-201
  calendar.ts      |   97.54 |       75 |     100 |   97.54 | 58-60
  coefficients.ts  |     100 |      100 |     100 |     100 |
  dayplan.ts       |   98.75 |    94.64 |     100 |   98.75 | 71-72
  explain-builtin  |     100 |    84.61 |     100 |     100 | 46-51
  exposure.ts      |   90.22 |    80.48 |     100 |   90.22 | 73,132-133,191
  heuristics.ts    |     100 |      100 |     100 |     100 |
  indoor.ts        |   96.24 |     73.8 |     100 |   96.24 | 153-157
  numbers.ts       |    97.8 |    95.45 |     100 |    97.8 | 137-138
  outlook.ts       |   95.52 |    82.35 |     100 |   95.52 | 33-34,79
  ports.ts         |     100 |      100 |     100 |     100 |
  ranking.ts       |   95.12 |    95.45 |     100 |   95.12 | 66-67
  response.ts      |     100 |      100 |     100 |     100 |
  rules-table.ts   |     100 |      100 |     100 |     100 |
  rules.ts         |     100 |    93.75 |     100 |     100 | 54
  types.ts         |   98.71 |       80 |     100 |   98.71 | 186-187
 src/lib           |   87.91 |       82 |   78.94 |   87.91 |
  constants.ts     |     100 |      100 |     100 |     100 |
  env.ts           |   85.24 |       75 |   66.66 |   85.24 | 55-57,98-103
  errors.ts        |     100 |     87.5 |     100 |     100 | 28
  geo.ts           |     100 |      100 |     100 |     100 |
  logger.ts        |   80.48 |    83.33 |   66.66 |   80.48 | 117-120,135-136
 src/server        |   91.60 |       75 |   85.71 |   91.60 |
  cache.ts         |   90.09 |    92.85 |      60 |   90.09 | 131-133,136-137
  cached-adapters  |   91.93 |      100 |      90 |   91.93 | 81-85
  container.ts     |   88.05 |    76.92 |     100 |   88.05 | 74-81
  pipeline-compute |   96.39 |    48.93 |     100 |   96.39 | 96-97,191-195
  pipeline-helpers |    90.8 |       90 |     100 |    90.8 | 60-65,85-86
  pipeline.ts      |   89.62 |    74.07 |     100 |   89.62 | 41-43,57-59,79-81
  safety.ts        |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

### Strict Line Count Audit ($<250$ Lines)

```
      39 src/server/pipeline-types.ts
      59 src/core/heuristics.ts
      74 src/adapters/prompts/ask.ts
      85 src/server/safety.ts
      86 src/server/cached-adapters.ts
      88 src/server/container.ts
     105 src/core/explain-builtin.ts
     108 src/core/outlook.ts
     108 src/server/pipeline-helpers.ts
     130 src/adapters/air-quality-composite.ts
     138 src/server/cache.ts
     144 src/adapters/geocoding.ts
     144 src/core/response.ts
     146 src/server/pipeline.ts
     159 src/core/numbers.ts
     182 src/core/calendar.ts
     189 src/core/actions.ts
     194 src/core/ports.ts
     199 src/adapters/open-meteo.ts
     199 src/core/indoor.ts
     217 src/core/aqi.ts
     220 src/core/exposure.ts
     227 src/core/coefficients.ts
     229 src/adapters/http.ts
     232 src/core/action-evaluators.ts
     236 src/server/pipeline-compute.ts
     242 src/adapters/jarvislabs-gemma.ts
     244 src/core/types.ts
     245 src/adapters/openaq.ts
     248 src/core/dayplan.ts
```

_Zero files violate the 250-line maximum constraint._

---

## 8. Additive Contract Changes

All contract changes were strictly additive to preserve backward compatibility:

1. `src/core/types.ts`:
   - Added `divergence?: { ratio: number; isDivergent: boolean }` to `AirQualitySnapshot`.
   - Added `ActionId` values: `"shared_clean_air_room_for_building"`, `"reduce_vehicle_idling_at_school_gates"`, `"organise_carpool_or_shared_transport"`.
2. `src/core/ports.ts`:
   - Added `QuestionLlmRequest` interface.
   - Added `answer(request: QuestionLlmRequest): Promise<Result<string, ProviderError>>` to `LlmClient`.
   - Added convenience type aliases: `AirQualityPort`, `WeatherPort`, `GeocodingPort`, `ClockPort`, `LoggerPort`.
3. `src/core/response.ts`:
   - Exported `AdviceResponseSchema` and inferred `AdviceResponse` type uniting AQI readings, indoor metrics, ranked actions, dayplans, calendar events, and AI/built-in explanations.
