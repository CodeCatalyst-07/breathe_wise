# BreatheWise Production Deployment Guide (Vercel)

This guide documents the production deployment of BreatheWise on Vercel, including runtime requirements, environment variables, post-deploy smoke verification, and serverless architectural caveats.

---

## 1. Prerequisites & Runtime Environment

- **Hosting Platform**: Vercel (Hobby, Pro, or Enterprise)
- **Framework Preset**: Next.js
- **Node.js Runtime Version**: `22.x` (or `20.x`)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

---

## 2. Environment Variables Configuration

Configure the following environment variables in the Vercel Dashboard under **Project Settings > Environment Variables**:

| Variable Name            | Required |         Default Value          | Description                                                                                                 |
| :----------------------- | :------: | :----------------------------: | :---------------------------------------------------------------------------------------------------------- |
| `JARVISLABS_API_KEY`     | **Yes**  |             _None_             | Bearer API token for Jarvis Labs inference server hosting Google Gemma 4 31B IT.                            |
| `OPENAQ_API_KEY`         | **Yes**  |             _None_             | API key for OpenAQ v3 sensor network endpoints.                                                             |
| `FEATURE_PURIFIER_LABEL` |    No    |            `false`             | Enables experimental multimodal purifier sticker OCR reader. Must remain `false` unless explicitly enabled. |
| `NEXT_PUBLIC_APP_URL`    |    No    | `https://<project>.vercel.app` | Canonical deployment URL for metadata and OpenGraph tags.                                                   |

---

## 3. Deployment Steps

### Option A: Via Vercel Web Dashboard (Recommended)

1. Push the repository to GitHub.
2. In Vercel, click **"Add New Project"** and select the repository.
3. Keep the default Next.js build settings (`npm run build`).
4. In the **Environment Variables** section, add `JARVISLABS_API_KEY`, `OPENAQ_API_KEY`, and `FEATURE_PURIFIER_LABEL=false`.
5. Click **"Deploy"**.

### Option B: Via Vercel CLI

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Link project and deploy preview
vercel

# 3. Set production environment variables
vercel env add JARVISLABS_API_KEY production
vercel env add OPENAQ_API_KEY production
vercel env add FEATURE_PURIFIER_LABEL production

# 4. Trigger production deployment
vercel --prod
```

---

## 4. Post-Deployment Verification Checklist

Once the deployment completes, verify the live deployment using the following steps:

### 1. Health Probe Verification

```bash
curl -f https://<your-deployment-url>/api/health
```

Expected response:

```json
{ "status": "ok" }
```

### 2. Security Headers & CSP Audit

```bash
curl -I https://<your-deployment-url>/
```

Verify the following headers are present:

- `Content-Security-Policy`: Contains `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, and excludes `'unsafe-eval'`.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 3. Automated API Smoke Suite

Run the remote API smoke suite against the production URL:

```bash
NEXT_PUBLIC_APP_URL=https://<your-deployment-url> npm run smoke:api
```

All endpoints (`/api/geocode`, `/api/advice`, `/api/explain`, `/api/ask`) should return HTTP 200 with valid schema payloads.

---

## 5. Serverless Architectural Caveats

BreatheWise is designed to execute cleanly in serverless container environments (AWS Lambda / Vercel Serverless Functions). However, note the following architectural characteristics:

1. **In-Memory Cache Lifecycle**:
   - `InMemoryCache` (`src/server/cache.ts`) operates within the ephemeral memory of individual serverless function instances.
   - Cache hits occur during warm invocations. On cold starts or across distributed edge regions, instances repopulate caches independently.
   - _Scale Recommendation_: For high-concurrency multi-region deployments, back `InMemoryCache` with a Redis cluster (Upstash / AWS ElastiCache).
2. **Rate Limiter Storage**:
   - `RateLimiter` (`src/server/http/rate-limit.ts`) uses an in-process sliding window. Each serverless instance tracks its own bucket count.
   - _Scale Recommendation_: For enterprise strict rate-limiting across distributed serverless instances, delegate to an edge gateway or Redis rate limiter.
3. **Execution Timeouts**:
   - Vercel Hobby serverless functions have a maximum execution duration of 10–15 seconds.
   - Upstream client timeouts (`OpenAQ`: 5s, `Open-Meteo`: 5s, `Gemma LLM`: 15s) are configured to ensure responses return before function termination.
