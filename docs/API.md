# BreatheWise HTTP API Specification

## 1. Overview & Architectural Principles

The BreatheWise API provides real-time, deterministic winter smog advisories, hyper-local pollution metrics, and LLM-synthesized narrative guidance.

### Security & Invariants:

- **No Wildcard CORS**: All endpoints enforce same-origin requests; cross-site state-changing calls (`POST`) are rejected with `403 Forbidden`. No `Access-Control-*` headers are returned.
- **Strict Payload Bounds**: Request bodies are read as a stream capped at **8 KB** (HTTP 413). Content-Type must be `application/json` (HTTP 415).
- **Zod Strict Validation**: All schemas use `.strict()`. Unknown fields trigger HTTP 400. Validation errors return property paths and generic messages only; **user input is never echoed**.
- **Privacy Minimisation**: Exact GPS coordinates and sensitive health context (asthma, children, elderly) are **session-only**. They are **never logged**, persisted, or forwarded to external LLMs.
- **Rate Limiting**: Sliding window in-memory limiter using salted SHA-256 IP hashing. Raw client IPs are never retained.
- **Fail-Safe Offline Mode**: Core calculations, AQI categorizations, and routines are pure and deterministic. When the LLM (Google Gemma 4 31B IT via Jarvis Labs) is unavailable or rate-limited, the system falls back seamlessly to deterministic built-in guidance (`source: "builtin"`).

---

## 2. Standard Error Envelope

All error responses return a uniform envelope containing machine-readable error codes and safe, sanitized user-facing messages:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Validation error: invalid request payload structure",
    "requestId": "4f9f4959-1fbf-4588-a697-1e6225c47225",
    "details": [
      {
        "path": "profile.location.lat",
        "message": "Number must be less than or equal to 90"
      }
    ]
  }
}
```

### HTTP Status Code Reference

| Status  | Code                                | Trigger Condition                                                                 |
| :------ | :---------------------------------- | :-------------------------------------------------------------------------------- |
| **400** | `validation_error` / `invalid_json` | Unknown JSON fields, schema failure, malformed syntax.                            |
| **403** | `forbidden`                         | Cross-site fetch detected (`Sec-Fetch-Site: cross-site`) or mismatched origin.    |
| **405** | `method_not_allowed`                | Method not in allowlist (e.g. GET on a POST route). Returns `Allow` header.       |
| **413** | `payload_too_large`                 | Streamed request body exceeds 8,192 bytes (8 KB).                                 |
| **415** | `unsupported_media_type`            | Missing or invalid `Content-Type: application/json`.                              |
| **429** | `rate_limited`                      | Client exceeded sliding window request limit. Returns `Retry-After: <seconds>`.   |
| **500** | `internal_error`                    | Unexpected runtime error. Internal message redacted; logs contain requestId only. |
| **503** | `assistant_unavailable`             | External GenAI assistant (Jarvis Labs) is unconfigured or unresponsive.           |
| **504** | `timeout`                           | Upstream or route execution exceeded 25-second deadline.                          |

---

## 3. Endpoints

### 3.1 `GET /api/health`

- **Purpose**: System health and liveness probe. Deliberately returns no environment variables or internal system topology.
- **Rate Limit**: 60 requests/minute.

#### Response Example (200 OK)

```json
{
  "status": "ok"
}
```

---

### 3.2 `GET /api/geocode`

- **Purpose**: Geocodes address or neighborhood queries into candidate locations with coordinates and IANA timezones. Cached for 24 hours.
- **Rate Limit**: 30 requests/minute ($1.5\times$ base).

#### Query Parameters:

- `q` (string, required, 2–100 characters): City or area query (e.g. `Connaught Place` or `Delhi`).
- `lang` (string, optional, `"en"` | `"hi"`): Preferred language.

#### Request Example

```http
GET /api/geocode?q=Connaught%20Place&lang=en HTTP/1.1
Host: localhost:3000
```

#### Response Example (200 OK)

```json
{
  "candidates": [
    {
      "label": "Connaught Place, New Delhi",
      "admin": "Delhi",
      "country": "India",
      "lat": 28.6315,
      "lng": 77.2167,
      "timezone": "Asia/Kolkata"
    }
  ]
}
```

---

### 3.3 `POST /api/advice`

- **Purpose**: **Fast path** advisory generation. Executes pure deterministic math, indoor mass-balance modeling, action ranking, and 24-hour day planning without invoking an LLM ($<10\text{ ms}$ compute).
- **Rate Limit**: 20 requests/minute ($1.0\times$ base).
- **Privacy**: Zero external LLM calls. No health context logged.

#### Request Example

```http
POST /api/advice HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "profile": {
    "location": {
      "lat": 28.6139,
      "lng": 77.209,
      "label": "Central Delhi",
      "timezone": "Asia/Kolkata"
    },
    "household": {
      "childrenAgeBands": ["0-2"],
      "hasElderly": true,
      "hasRespiratoryCondition": true
    },
    "commuteMode": "auto_rickshaw",
    "home": {
      "roomVolumeM3": 45,
      "windowsHabit": "closed_all_day",
      "purifierCadrM3h": 250,
      "cookingFuel": "lpg"
    },
    "budgetInr": 5000,
    "language": "en"
  }
}
```

#### Response Example (200 OK)

```json
{
  "requestId": "9e70f324-6398-46da-ac7c-8ff6247eae57",
  "generatedAt": "2026-11-19T10:00:00.000Z",
  "timezone": "Asia/Kolkata",
  "location": {
    "label": "Central Delhi",
    "roundedLat": 28.61,
    "roundedLng": 77.21
  },
  "dataStatus": "available",
  "airQuality": {
    "reading": {
      "pm25": 180,
      "concentration": 180,
      "category": "very_poor",
      "kind": "measured",
      "basis": "instantaneous",
      "labelKey": "aqi.category.very_poor",
      "basisLabelKey": "aqi.basis.instantaneous",
      "ordinal": 4
    },
    "provenance": "openaq",
    "attributions": ["OpenAQ", "Copernicus"]
  },
  "outlook": {
    "status": "stable",
    "summaryKey": "outlook.status.stable",
    "hourlyForecast": [
      {
        "timeIso": "2026-11-19T10:00:00.000Z",
        "hourLocal": 10,
        "pm25": 180,
        "category": "very_poor"
      }
    ]
  },
  "dayPlan": {
    "dataStatus": "available",
    "slots": [
      {
        "hourLocal": 10,
        "timestamp": "2026-11-19T10:00:00.000Z",
        "pm25": 180,
        "category": "very_poor",
        "outdoorActivity": "avoid",
        "ventilationOk": false
      }
    ],
    "avoidWindows": []
  },
  "calendarEvents": [
    {
      "id": "best_outdoor",
      "title": "Low-Exposure Outdoor Window",
      "startIso": "2026-11-19T11:00:00.000Z",
      "endIso": "2026-11-19T12:00:00.000Z",
      "details": "Safest ambient window for necessary outdoor errands.",
      "url": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Low-Exposure+Outdoor+Window..."
    }
  ],
  "actions": [
    {
      "rank": 1,
      "reasonKey": "reasons.vulnerable_hepa_protection",
      "group": "household",
      "result": {
        "actionId": "use_hepa_purifier",
        "displayMode": "numeric",
        "baseline": 110,
        "scenario": 35,
        "deltaLow": 60,
        "deltaLikely": 75,
        "deltaHigh": 85,
        "unit": "ug/m3",
        "direction": "reduces",
        "confidence": "high",
        "assumptions": ["assumptions.purifier_owned_cadr"]
      },
      "builtinExplanation": {
        "actionId": "use_hepa_purifier",
        "whatToDoKey": "builtin_explanations.use_hepa_purifier.what_to_do",
        "whyItMattersKey": "builtin_explanations.use_hepa_purifier.why_it_matters",
        "assumptionsKeys": ["assumptions.purifier_owned_cadr"]
      }
    }
  ],
  "assumptions": [
    {
      "key": "purifier_owned_cadr",
      "status": "assumption",
      "confidence": "medium",
      "source": "Modeller assumption - verify before citing",
      "description": "Operating owned purifier CADR"
    }
  ],
  "safety": {
    "disclaimerKey": "safety.disclaimer.general_guidance",
    "medicalHelpKey": "safety.medical.seek_help_for_symptoms"
  }
}
```

---

### 3.4 `POST /api/explain`

- **Purpose**: Enriches pre-computed advice with a natural language narrative generated by **Google Gemma 4 31B IT** (hosted on Jarvis Labs).
- **Guard Order**:
  1. Zod structure parsing.
  2. Number whitelist validation against computed figures and hour labels (with 1 retry listing disallowed tokens).
  3. Safety filter (medical claims, dosage, cure guarantees).
- **Fault-Tolerant Invariant**: **NEVER fails with 5xx because of the LLM**. On LLM outage or guard violation, returns 200 OK with `explanation.source: "builtin"`.
- **Rate Limit**: 10 requests/minute ($0.5\times$ base).

#### Request Example

Identical payload to `POST /api/advice`.

#### Response Example (200 OK)

```json
{
  "requestId": "9220cdae-71ad-44db-9404-6f1e15550243",
  "dataStatus": "available",
  "explanation": {
    "source": "ai",
    "summary": "Hazardous PM2.5 levels of 180 ug/m3 observed in Central Delhi. High priority should be given to running your HEPA air purifier continuously indoors to lower indoor exposure to ~35 ug/m3.",
    "perAction": [
      {
        "actionId": "use_hepa_purifier",
        "text": "Your air purifier delivers approximately 75 ug/m3 reduction in indoor particulate concentration."
      }
    ]
  }
}
```

---

### 3.5 `POST /api/ask`

- **Purpose**: Conversational assistant answering user follow-up questions grounded in verified server-side metrics.
- **Security**: User question is quarantined inside `<user_question>` XML tags. Strict schema rejects client-supplied `results`.
- **Off-Topic & Medical Refusal**: Returns 200 OK with `{ declined: true, reasonKey: "..." }`.
- **LLM Outage**: Returns 503 Service Unavailable `{ code: "assistant_unavailable" }`.
- **Rate Limit**: 10 requests/minute ($0.5\times$ base).

#### Request Example

```http
POST /api/ask HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "profile": {
    "location": { "lat": 28.6139, "lng": 77.209, "label": "Delhi" },
    "household": { "childrenAgeBands": [], "hasElderly": false, "hasRespiratoryCondition": false },
    "commuteMode": "metro",
    "home": { "windowsHabit": "closed_all_day", "cookingFuel": "lpg" },
    "language": "en"
  },
  "question": "Can I open my balcony windows tomorrow morning?",
  "history": [
    { "role": "user", "text": "What is the forecast?" },
    { "role": "assistant", "text": "PM2.5 is forecast to remain poor." }
  ]
}
```

#### Response Example (200 OK - Answered)

```json
{
  "answer": "Ventilation is not recommended tomorrow morning as outdoor PM2.5 exceeds 150 ug/m3. Keep windows sealed until the low-exposure window around midday.",
  "explanationSource": "ai"
}
```

#### Response Example (200 OK - Medical/Off-Topic Declined)

```json
{
  "declined": true,
  "reasonKey": "safety.medical.seek_help_for_symptoms",
  "explanationSource": "builtin",
  "answer": "I can only offer exposure reduction engineering guidance. Please consult a qualified medical professional for health symptoms or clinical treatment."
}
```

---

### 3.6 `POST /api/parse-profile`

- **Purpose**: Uses Google Gemma 4 31B IT to parse unstructured user text into a structured draft `HouseholdProfile` and a list of recognized fields.
- **Privacy Invariant**: Never persists profile data or user text to disk or database.
- **Rate Limit**: 10 requests/minute ($0.5\times$ base).

#### Request Example

```http
POST /api/parse-profile HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "text": "We commute by metro every day. My elderly mother lives with us and has asthma. We keep windows closed all day.",
  "language": "en"
}
```

#### Response Example (200 OK)

```json
{
  "draftProfile": {
    "location": {
      "lat": 28.6139,
      "lng": 77.209,
      "label": "Delhi NCR (Default)",
      "timezone": "Asia/Kolkata"
    },
    "household": {
      "childrenAgeBands": [],
      "hasElderly": true,
      "hasRespiratoryCondition": true
    },
    "commuteMode": "metro",
    "home": {
      "roomVolumeM3": 45,
      "windowsHabit": "closed_all_day",
      "purifierCadrM3h": 0,
      "cookingFuel": "lpg"
    },
    "language": "en"
  },
  "understoodFields": ["commuteMode", "hasElderly", "hasRespiratoryCondition", "windowsHabit"]
}
```

---

### 3.7 `POST /api/read-purifier-label`

- **Purpose**: Uses Google Gemma 4 31B IT multimodal vision capabilities to extract Clean Air Delivery Rate (CADR), airflow ratings, brand, and model from purifier specifications stickers.
- **Payload Limit**: Strictly enforced 1.5 MB body limit.
- **Magic Bytes Validation**: Verifies binary signatures for JPEG (`0xFF 0xD8 0xFF`), PNG (`0x89 0x50 0x4E 0x47`), and WebP (`RIFF...WEBP`).
- **Privacy Invariant**: Zero image persistence; base64 payload processed strictly in ephemeral memory and discarded immediately.
- **Rate Limit**: 10 requests/minute ($0.5\times$ base).

#### Request Example

```http
POST /api/read-purifier-label HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "mimeType": "image/png"
}
```

#### Response Example (200 OK)

```json
{
  "cadrM3h": 340,
  "rawCadr": 200,
  "unit": "cfm",
  "brand": "Coway",
  "model": "AP-1512HH",
  "confidence": "high"
}
```

---

## 4. Privacy Boundary & Prompt Quarantine

| Data Field                                     | Sent to LLM?                                    | Logged on Server?           | Included in Calendar URL? |
| :--------------------------------------------- | :---------------------------------------------- | :-------------------------- | :------------------------ |
| **Exact GPS Coordinates** (`lat`, `lng`)       | ❌ **NEVER**                                    | ❌ **NEVER**                | ❌ **NEVER**              |
| **User Full Address**                          | ❌ **NEVER**                                    | ❌ **NEVER**                | ❌ **NEVER**              |
| **Child Age Bands** (`0-2`, `3-5`, etc.)       | ❌ **NEVER** (anonymized to `vulnerable: true`) | ❌ **NEVER**                | ❌ **NEVER**              |
| **Specific Health Conditions** (Asthma, etc.)  | ❌ **NEVER** (anonymized to `vulnerable: true`) | ❌ **NEVER**                | ❌ **NEVER**              |
| **Client IP Address**                          | ❌ **NEVER** (salted SHA-256 hash only)         | ❌ **NEVER**                | ❌ **NEVER**              |
| **Pre-Computed Numbers** (`deltaLikely`, etc.) | ✅ Only computed values                         | ❌ Omitted from access logs | ❌ Omitted                |
| **Place Label** (e.g. "Central Delhi")         | ✅ City/Region only                             | ❌ Omitted                  | ❌ Omitted                |
