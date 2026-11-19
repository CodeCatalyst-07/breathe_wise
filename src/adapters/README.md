# External Adapters Layer

This directory holds thin infrastructure adapters that implement the contracts defined in `src/core/ports.ts`.

- `openaq.ts` — Implements `AirQualityProvider` using OpenAQ v3 API.
- `open-meteo.ts` — Implements `AirQualityProvider` (CAMS atmospheric models) and `WeatherProvider` (Open-Meteo weather API).
- `jarvislabs-gemma.ts` — Implements `LlmClient` talking to Google Gemma 4 31B IT hosted on Jarvis Labs.
- `geocoding.ts` — Implements `GeocodingProvider` for coordinate and place resolution.

All adapters return typed `Result<T, ProviderError>` containers and never bubble unhandled exceptions into the core domain or route handlers.
