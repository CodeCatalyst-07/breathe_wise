# Data Sources & External Integrations

BreatheWise combines real-time physical sensor observations, regional atmospheric dispersion forecasts, meteorological models, and generative language model explanations.

---

## 1. Ground Sensors: OpenAQ API v3

- **Provider**: OpenAQ Community Data Platform ([https://openaq.org](https://openaq.org))
- **Role**: Hyperlocal, ground-level physical station observations of PM2.5 and PM10.
- **Endpoint**: `https://api.openaq.org/v3/locations`
- **Authentication**: `X-API-Key` header with server environment variable `OPENAQ_API_KEY`.
- **Search Method**: Spherical nearest-station spatial search using the Haversine formula (`src/lib/geo.ts`) within a configurable radius (`OPENAQ_RADIUS_KM`, default 25 km).
- **Data Integrity & Rejection Rules**:
  - **Staleness**: Measurements older than `OPENAQ_MAX_AGE_MINUTES` (default 180 minutes / 3 hours) are rejected as stale.
  - **Plausibility Bounds**: PM2.5 concentrations outside $[0, 1500]\ \mu\text{g/m}^3$ are rejected as sensor malfunctions.
- **Graceful Fallback**: If `OPENAQ_API_KEY` is omitted or no active station is found within radius, the system returns code `misconfigured` / `not_found` and the composite air quality provider automatically and silently falls back to Open-Meteo model forecasts.
- **Attribution**: `"Data provided by OpenAQ (https://openaq.org)"`

---

## 2. Atmospheric & Particulate Forecasts: Open-Meteo (CAMS)

- **Provider**: Open-Meteo Air Quality API ([https://open-meteo.com/en/docs/air-quality-api](https://open-meteo.com/en/docs/air-quality-api))
- **Underlying Model**: Copernicus Atmosphere Monitoring Service (CAMS) ENSEMBLE.
- **Role**: Hourly 72-hour particulate forecast (`pm2_5`, `pm10`) across regional atmospheric cells.
- **Endpoint**: `https://air-quality-api.open-meteo.com/v1/air-quality`
- **Authentication**: None required.
- **Model Resolution Note**:
  > [!NOTE]
  > CAMS ENSEMBLE model resolution is coarse, tens of kilometres. It models regional background air quality and diurnal dispersion curves, rather than street-canyon or hyper-local traffic spikes.
- **Attribution**: `"Open-Meteo, based on CAMS ENSEMBLE data provider (Copernicus Atmosphere Monitoring Service)"`

---

## 3. Meteorological Forecasting: Open-Meteo Weather

- **Provider**: Open-Meteo Weather API ([https://open-meteo.com/en/docs](https://open-meteo.com/en/docs))
- **Role**: Meteorological conditions driving ventilation and dispersion: temperature, relative humidity, wind speed, wind direction, and precipitation.
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**: `hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation`, `wind_speed_unit=ms`, `forecast_days=3`, `timezone=UTC`.
- **Authentication**: None required.

---

## 4. Geocoding & Reverse Geocoding

- **Provider**: Open-Meteo Geocoding API ([https://open-meteo.com/en/docs/geocoding-api](https://open-meteo.com/en/docs/geocoding-api))
- **Role**: Resolving free-text place searches (e.g. "Rohini Sector 9, Delhi") to candidate geographic coordinates.
- **Endpoint**: `https://geocoding-api.open-meteo.com/v1/search`
- **Authentication**: None required.
- **Privacy & Reverse Geocoding**:
  - The application strictly avoids fine-grained reverse-geocoding tracking.
  - Browser coordinates are rounded to 2 decimal places ($\approx 1.1\text{ km}$ precision) before storage, querying, or logging, labeled generically as `"Current location"`.

---

## 5. Composite Air Quality Provider

`AirQualityCompositeAdapter` combines physical ground observations with regional dispersion models:

| Scenario   | OpenAQ (Sensors)          | Open-Meteo (CAMS) | Resolution Strategy                                                                                                      |
| :--------- | :------------------------ | :---------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Case 1** | Available & Valid         | Available & Valid | Current: OpenAQ (`measured`). Forecast: Open-Meteo (`model`). Evaluates divergence ratio; logs warning if $> 2.0\times$. |
| **Case 2** | Missing / Stale / Offline | Available & Valid | Current & Forecast: Open-Meteo (`model`). Silent fallback.                                                               |
| **Case 3** | Available & Valid         | Offline / Timeout | Current: OpenAQ (`measured`). Forecast: `[]`.                                                                            |
| **Case 4** | Offline / Stale           | Offline           | Returns structured `upstream_error`.                                                                                     |

---

## 6. GenAI Explanation Engine: Google Gemma 4 31B IT via Jarvis Labs

- **Model**: `gemma-4-31b-it` (Google Gemma 4 31B IT instruction-tuned).
- **Hosting Provider**: Jarvis Labs OpenAI-compatible API endpoint (`https://models.jarvislabs.net/v1`).
- **Role**: Empathetic, conversational synthesis of pre-computed decision engine results and unstructured profile parsing.
- **Honesty Rule Invariant**: The LLM NEVER computes raw scientific numbers. Numbers are strictly computed by `src/core/` and passed in context.
- **Automated Guardrails**:
  - `collectAllowedNumbers()` and `findDisallowedNumbers()` regex inspection validates every numeral in LLM output against the allowed engine output set.
  - Empirical endpoint configuration: `chat_template_kwargs: { enable_thinking: false }`, `max_tokens >= 2500`, raw markdown fence JSON parsing (avoids OpenAI `response_format` truncation bug).
  - Prompt injection protection: User inputs are wrapped in XML tags `<user_input>` with strict delimiter instructions and capped at 500 characters.
  - Retries: Automatic single retry on length cutoff (`finish_reason: "length"`) and prompt repair on malformed JSON.
  - Semaphore concurrency limiter throttles parallel LLM requests to `LLM_MAX_CONCURRENCY` (default 4).
- **Attribution**: `"Explanations synthesized using Google Gemma 4 31B IT via Jarvis Labs API"`

---

## 7. In-Memory Caching & Performance

- **Cache Implementation**: `InMemoryCache` (`src/server/cache.ts`) with TTL expiration and LRU eviction (default 500 records).
- **TTL Parameters**:
  - OpenAQ Observations: 10 minutes (`CACHE_TTL_OPENAQ_MS`)
  - Open-Meteo Air Quality: 30 minutes (`CACHE_TTL_OPEN_METEO_MS`)
  - Open-Meteo Weather: 30 minutes (`CACHE_TTL_WEATHER_MS`)
  - Geocoding Results: 24 hours (`CACHE_TTL_GEOCODING_MS`)
- **Single-Flight Deduplication**: In-flight promises are tracked in a pending map to prevent thundering herds on concurrent requests.
- **Serve-Stale-On-Error**: If an upstream provider temporarily fails or times out, the cache continues to serve expired entries up to $2\times$ TTL.
