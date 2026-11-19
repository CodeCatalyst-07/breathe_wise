# Infrastructure Layer Implementation Summary

The infrastructure layer for **BreatheWise** (Urban Air Quality Assistant) is implemented, thoroughly tested, and verified against all criteria.

---

### Step 0: Core Hardening & Decision Invariants

1. **Brute-Force Corner Uncertainty Verification**:
   - In [src/core/action-evaluators.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/action-evaluators.ts), the numerical actions (`ventilate_at_cleanest_hour`, `keep_windows_closed_in_peak`, and `use_hepa_purifier`) enumerate all corner combinations of $a \in [a_{\text{low}}, a_{\text{likely}}, a_{\text{high}}]$, $P$, $k$, and $\text{CADR}$ to compute the true minimum and maximum reduction bounds.
   - Verified via automated tests in [tests/unit/actions.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/actions.test.ts) asserting that `deltaLow` and `deltaHigh` match the exact minimum and maximum calculated across all parameter corners.
2. **Number Whitelist Regular Expression Hardening**:
   - In [src/core/numbers.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/numbers.ts), range hyphens (`"40-50%"`, `"40 to 50 percent"`) are normalized to standalone number tokens and verified against the allowed whitelist.
   - Masking ensures `PM2.5`, `PM10`, `N95`, `FFP2`, and calendar years (e.g. `2026`) do not trigger false rejections. Verified in [tests/unit/numbers.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/numbers.test.ts).
3. **Default Room Volume Attribution**:
   - `getRoomVolumeInfo(profile)` flags when `profile.home.roomVolumeM3` is omitted, adding `"assumptions.default_room_volume"` to `ImpactResult.assumptions`.
   - Key added to [src/i18n/en.json](file:///Users/arnav/Desktop/BreatheWise/src/i18n/en.json#L95) and verified in tests.

---

### Section 1: Shared HTTP Layer

- **Implementation**: [src/adapters/http.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/http.ts)
  - `fetchJson<T>` with injectable `fetchFn` for testing.
  - `AbortController` timeout (default 8s).
  - Maximum 2 retries with exponential backoff + jitter for network errors, 429, and 5xx (respects `Retry-After`).
  - Response size limit (default 2 MB) and `application/json` content-type validation.
  - Strict Zod schema validation of every external response payload before acceptance.
  - SSRF guard: fixed base URL constants, `URLSearchParams` parameter encoding, coordinate range verification ($[-90, 90]$ / $[-180, 180]$), and query text length cap ($\le 100$ characters).
  - Redacting logging: logs `method`, `host`, `path`, `status`, and `durationMs` only; never logs query strings, authorization headers, or response bodies.
- **Unit Tests**: [tests/unit/http.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/http.test.ts) (10 tests covering success, validation failure, 404, 429 retry backoff, 5xx retry backoff, non-retryable 400, size limits, and SSRF coordinates).

---

### Section 2: Geocoding Adapter

- **Implementation**: [src/adapters/geocoding.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/geocoding.ts)
  - Open-Meteo Geocoding API (`/v1/search`) with language support ("en" / "hi").
  - `reverseGeocode(lat, lng)` rounds coordinates to 2 decimal places ($\approx 1.1\text{ km}$ privacy buffer) and assigns label `"Current location"`.
- **Unit Tests**: [tests/unit/geocoding.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/geocoding.test.ts).

---

### Section 3: Open-Meteo Air Quality & Weather

- **Implementation**: [src/adapters/open-meteo.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/open-meteo.ts)
  - Air Quality (`/v1/air-quality`): CAMS ENSEMBLE atmospheric model returning current PM2.5/PM10 and 72-hour hourly forecasts (`kind: "model"`, `basis: "instantaneous"`, `ATTRIBUTION_OPEN_METEO_CAMS`). Regional resolution ($\sim 10\text{--}25\text{ km}$) documented.
  - Weather (`/v1/forecast`): Hourly temperature, humidity (clamped to 0–100%), wind speed (in m/s), wind direction, and precipitation.
- **Unit Tests**: [tests/unit/open-meteo.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/open-meteo.test.ts).

---

### Section 4: OpenAQ v3 Adapter & Spatial Geodesy

- **Implementation**: [src/adapters/openaq.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/openaq.ts) and [src/lib/geo.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/geo.ts)
  - Pure `haversineDistanceKm(lat1, lon1, lat2, lon2)` spherical great-circle calculation.
  - OpenAQ v3 `/locations` nearest-station query with `X-API-Key` authentication.
  - Rejects measurements older than `OPENAQ_MAX_AGE_MINUTES` (default 180 min) as stale.
  - Rejects implausible readings ($<0$ or $>1500\ \mu\text{g/m}^3$).
  - If `OPENAQ_API_KEY` is omitted or empty, returns `code: "misconfigured"` to allow silent composite fallback.
- **Unit Tests**: [tests/unit/geo.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/geo.test.ts) & [tests/unit/openaq.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/openaq.test.ts).

---

### Section 5: Composite Air Quality Provider

- **Implementation**: [src/adapters/air-quality-composite.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/air-quality-composite.ts)
  - Executes OpenAQ and Open-Meteo in parallel via `Promise.allSettled`.
  - Divergence ratio calculation: $\frac{\max(m, c)}{\max(\min(m, c), 1)}$. Logs warning when divergence $> 2.0\times$.
  - 4-Case Fallback Matrix:
    1. **OpenAQ OK + Open-Meteo OK**: Current from OpenAQ (`measured`), forecast from Open-Meteo (`model`).
    2. **OpenAQ fails / stale + Open-Meteo OK**: Current and forecast from Open-Meteo (`model`).
    3. **OpenAQ OK + Open-Meteo fails**: Current from OpenAQ, forecast empty array.
    4. **Both fail**: Structured `upstream_error`.
- **Unit Tests**: [tests/unit/air-quality-composite.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/air-quality-composite.test.ts).

---

### Section 6: In-Memory Cache

- **Implementation**: [src/server/cache.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/cache.ts)
  - TTL expiration and LRU eviction (default 500 entries).
  - Single-flight deduplication via pending promises map prevents thundering herds.
  - Serve-stale-on-error support up to `maxStaleMs` ($2\times$ TTL).
  - `buildCoordinateCacheKey(prefix, lat, lng)` rounds coordinates to 2 decimal places (`aq:28.61,77.21`).
  - TTL constants: OpenAQ (10 min), Open-Meteo AQ (30 min), Weather (30 min), Geocoding (24 hrs).
- **Unit Tests**: [tests/unit/cache.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/cache.test.ts).

---

### Section 7: Google Gemma LLM Client (Jarvis Labs)

- **Implementation**: [src/adapters/jarvislabs-gemma.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/jarvislabs-gemma.ts)
  - Prompt templates: [src/adapters/prompts/profile-parser.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/prompts/profile-parser.ts) and [src/adapters/prompts/explanation.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/prompts/explanation.ts).
  - Endpoint configuration: `chat_template_kwargs: { enable_thinking: false }`, `max_tokens >= 2500`, temperature 0.2. Raw JSON / markdown fence parsing.
  - Injection immunity: User profile input wrapped in `<user_input>` XML tags with strict delimiter instructions and capped at 500 characters.
  - Automatic single repair retry on `finish_reason: "length"` (elevates to 3500 tokens) and malformed JSON output.
  - Automated numbers whitelist guard (`collectAllowedNumbers` / `findDisallowedNumbers`).
  - In-process semaphore concurrency limiter (`LLM_MAX_CONCURRENCY`, default 4).
- **Unit Tests**: [tests/unit/llm-client.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/llm-client.test.ts).

---

### Section 8: Environment & Security Safeguards

- **Implementation**: [src/lib/env.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/env.ts) and [.env.example](file:///Users/arnav/Desktop/BreatheWise/.env.example)
  - `OPENAQ_API_KEY` and `JARVISLABS_API_KEY` are optional in validation so the decision engine boots without API keys.
  - Defaults: `OPENAQ_RADIUS_KM` (25), `OPENAQ_MAX_AGE_MINUTES` (180), `LLM_MAX_CONCURRENCY` (4), `LLM_TIMEOUT_MS` (15000).
  - Security guardrails: Rejection of any secret variable bearing `NEXT_PUBLIC_`, and error messages listing only variable names.
  - Log leakage prevention test in [tests/security/log-leakage.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/security/log-leakage.test.ts).

---

### Section 9: Contract Tests & Verification

- **Fixtures**: Recorded JSON responses in [tests/contract/fixtures/](file:///Users/arnav/Desktop/BreatheWise/tests/contract/fixtures/) (`open-meteo-aq.json`, `open-meteo-weather.json`, `open-meteo-geocoding.json`, `openaq-locations.json`, `gemma-completion.json`).
- **Contract Test Suite**: [tests/contract/adapters.contract.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/contract/adapters.contract.test.ts) (runs with zero network dependency).
- **Live Smoke Script**: [scripts/smoke-live.ts](file:///Users/arnav/Desktop/BreatheWise/scripts/smoke-live.ts) registered as `"smoke:live": "tsx scripts/smoke-live.ts"` in `package.json`.

---

### Section 10: Documentation & Line Limits

- **Data Sources Guide**: [docs/DATA_SOURCES.md](file:///Users/arnav/Desktop/BreatheWise/docs/DATA_SOURCES.md) created with full details on providers, endpoints, resolutions, attribution, and fallbacks.
- **Architecture Updates**: [docs/ARCHITECTURE.md](file:///Users/arnav/Desktop/BreatheWise/docs/ARCHITECTURE.md#L107) updated with infrastructure pipeline and data-flow specifications.
- **File Length Invariant**: Every single file in `src/` is strictly under 250 lines (largest file is 246 lines).

---

### Verification Results

- `npm run lint`: **0 errors, 0 warnings**
- `npm run typecheck`: **Clean pass (0 errors)**
- `npm run test`: **26 test files passed (242 / 242 tests passed)**
- `npm run test:coverage`: **97.71% statement coverage in `src/core/`**
