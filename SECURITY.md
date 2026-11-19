# Security Policy and Threat Model: BreatheWise

BreatheWise is designed with a defense-in-depth security model to safeguard family privacy and maintain data integrity during hazardous winter air pollution emergencies.

---

## 1. Threat Model & Architectural Defenses

### 1.1 Secrets & Credential Management

- **Environment Isolation:** All secret keys (`JARVISLABS_API_KEY`, `OPENAQ_API_KEY`) reside exclusively in server-side process environments and are validated via [env.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/env.ts).
- **Client Leakage Prevention:** [env.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/env.ts) explicitly throws if any sensitive variable begins with `NEXT_PUBLIC_`.
- **Repository Hygiene:** `.gitignore` blocks `.env*` (except `.env.example`). The automated scanner [scripts/check-secrets.ts](file:///Users/arnav/Desktop/BreatheWise/scripts/check-secrets.ts) runs on every commit and CI execution to block tracked secrets.

### 1.2 Input Validation & Strict Schema Boundaries

- **Strict Zod Schemas:** Every HTTP entry point ([schemas.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/http/schemas.ts)) enforces `.strict()`, rejecting unexpected keys.
- **Bounded Numerical Inputs:** Coordinates are bounded (`-90 <= lat <= 90`, `-180 <= lng <= 180`), labels capped to 200 characters, questions capped to 300 characters, and request bodies capped to 8 KB / 16 KB ([body-reader.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/http/body-reader.ts)).

### 1.3 Rate Limiting & Serverless Characteristics

- **Sliding Window Limiter:** Implemented in [rate-limiter.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/http/rate-limiter.ts) hashing client IP addresses using SHA-256 with a daily rotating salt.
- **Serverless Limitation:** In multi-instance serverless deployments (e.g. Vercel), in-memory rate limiting operates per-instance. For multi-region enterprise distribution, a Redis/KV store can back the provider.

### 1.4 Same-Origin & Cross-Site Protection

- **Origin Verification:** In [api-handler.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/http/api-handler.ts), state-changing requests (`POST`) verify the `Origin` and `Host` headers.
- **Sec-Fetch-Site Check:** Rejects requests where `Sec-Fetch-Site === "cross-site"` with HTTP 403 Forbidden.

### 1.5 Content Security Policy (CSP) & HTTP Headers

- **Strict Directives:** Configured in [next.config.ts](file:///Users/arnav/Desktop/BreatheWise/next.config.ts):
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (`'unsafe-eval'` is strictly excluded in production builds)
  - `object-src 'none'`
  - `frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

### 1.6 Privacy & Data Minimization

- **Transient Storage:** User household profiles and custom room sizes are held strictly in browser `sessionStorage` and React state. `localStorage` is **never written** (verified by automated tests in [storage.test.ts](file:///Users/arnav/Desktop/BreatheWise/tests/unit/storage.test.ts)).
- **Log Sanitation:** [logger.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/logger.ts) redacts coordinates, query strings, and demographic age bands from server stdout.
- **Immediate Data Wipe:** "Clear my details" button completely flushes session storage and resets all state to defaults.

### 1.7 GenAI Guardrails & Prompt Injection Defenses

- **Quarantined Delimiters:** User questions are quarantined within `<user_question>` and `<prior_conversation>` XML tags ([ask.ts](file:///Users/arnav/Desktop/BreatheWise/src/adapters/prompts/ask.ts)).
- **Enforced Guard Order:**
  1. Zod schema validation of LLM output.
  2. Number whitelist filter ([numbers.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/numbers.ts)) allowing only pre-computed values and timeline hours.
  3. Content safety filter ([safety.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/safety.ts)) blocking medical diagnosis, off-topic requests, and toxic instructions.
  4. Built-in explanation fallback if any guard fails.

### 1.8 Multimodal Purifier Label Upload Security

- **Client-Side Downscaling:** Images are resized on client canvas to $\le 1024\text{px}$ and compressed before upload ([image-downscale.ts](file:///Users/arnav/Desktop/BreatheWise/src/lib/image-downscale.ts)).
- **Binary Magic Bytes Inspection:** [purifier-reader.ts](file:///Users/arnav/Desktop/BreatheWise/src/server/purifier-reader.ts) inspects binary headers to accept only valid JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`RIFF...WEBP`) buffers.
- **Body Cap:** Enforces a strict 1.5 MB body limit.

### 1.9 Dependency Vulnerability Policy

- **Audit Findings:** `npm audit` flags issues requiring breaking major upgrades (`next@16`, `vitest@4`, `zod@4`).
- **Mitigation:**
  - `zod`: ReDoS advisory (GHSA-mrhx-c7xc-m3w5) is mitigated by BreatheWise's strict 8 KB / 16 KB body size cap and bounded collection constraints.
  - `postcss`: Embedded Next.js 15 internal dependency, mitigated by strict CSP and lack of user-supplied CSS compilation.
  - `tinypool`: Vitest testing runner dependency; never executed in production runtime.

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in BreatheWise, please do NOT file a public issue. Contact the engineering maintainers privately via GitHub Security Advisories or email security@breathewise.local. Responsible disclosures are investigated and remediated within 48 hours.
