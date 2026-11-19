# BreatheWise Website UI & Accessible Front-End Implementation Report

## Executive Summary

Phase 4 of **BreatheWise (Urban Air Quality Assistant)** is complete. The system now features a distinctive, responsive, highly accessible website UI for mobile devices (390×844) and desktop displays (1280×800) engineered for families navigating hazardous winter smog inversions across Indian cities.

---

## 1. Core Architectural & Design Invariants Enforced

### 1.1 The UI Never Does Science (Honesty Rule)

- The UI contains zero derived math, invented percentages, or synthetic CO2e calculations.
- It strictly formats and displays values returned by the core decision engine and orchestrator (`/api/advice`, `/api/explain`).
- Numerical reductions display exact modeled baselines and ranges (`deltaLikely`, `deltaLow`, `deltaHigh`).
- Qualitative interventions (masks, transit, community actions) render clean directional badges (`"Reduces exposure"`, `"Likely reduces exposure"`) without false numeric precision.

### 1.2 Schema-Driven Enumerations

- All option lists and dropdowns are dynamically mapped directly from the core Zod schemas (`src/core/types.ts`):
  - Children age bands: `ChildrenAgeBandSchema.options` (`["0-2", "3-5", "6-12", "13-18"]`)
  - Commute modes: `CommuteModeSchema.options` (`["walk", "bicycle", "two_wheeler", "auto_rickshaw", "car", "bus", "metro", "train", "work_from_home"]`)
  - Window ventilation habits: `WindowsHabitSchema.options` (`["always_open", "morning_ventilate", "afternoon_ventilate", "evening_ventilate", "closed_all_day", "ventilate_as_needed"]`)
  - Cooking fuels: `CookingFuelSchema.options` (`["lpg", "electric_induction", "piped_natural_gas", "biomass_wood", "kerosene"]`)
- Zero hardcoded option arrays exist in the UI layer.

### 1.3 100% Internationalized UI Copy

- All visible text originates from internationalization keys in `src/i18n/en.json` under the structured `ui.*` namespace.
- Dotted key lookup with parameter interpolation (`{place}`, `{category}`, `{pm25}`, `{multiple}`) and fallback from Hindi to English implemented via `src/lib/i18n.ts`.

### 1.4 Strict Session-Only Ephemeral Storage (Privacy Boundary)

- User demographic and health details live strictly in React state and `sessionStorage`.
- `localStorage` is **never touched** (verified with automated spy tests).
- Prominent "Clear my details" controls in both the household form and footer immediately wipe all browser session memory.

### 1.5 Demonstrable WCAG 2.1 AA Accessibility

- **Color Contrast**: Automated programmatic luminance verification (`tests/unit/contrast.test.ts`) confirms:
  - Ink (`#14262F`) on Surface (`#FFFFFF`): **15.6:1** (exceeds 7.0:1 AAA).
  - Ink (`#14262F`) on Paper (`#F2F5F6`): **14.2:1** (exceeds 7.0:1 AAA).
  - Ink Muted (`#4A5E68`) on Surface (`#FFFFFF`): **6.8:1** (exceeds 4.5:1 AA).
  - White on Action Blue (`#0B6E8A`): **5.8:1** (exceeds 4.5:1 AA).
  - White on ActionHover Blue (`#08566C`): **8.2:1** (exceeds 4.5:1 AA).
  - Ink on all 6 CPCB light tints: all **> 12:1** (exceeds 4.5:1 AA).
  - Graphical category marks on Surface: all **> 3.0:1** (meets non-text contrast).
- **Focus Rings**: Universal `outline: 3px solid var(--color-action); outline-offset: 2px;`.
- **Keyboard Navigation**: Skip to content link (`#main-content`), W3C ARIA 1.2 Combobox with arrow navigation, escape to dismiss, enter to select.
- **Screen Reader Support**: Complete hidden tabular breakdown (`<table>`) for forecast sparkline, semantic landmarks (`<header>`, `<main>`, `<aside>`, `<footer>`, `<fieldset>`, `<legend>`), live regions (`aria-live="polite"`), and `aria-hidden="true"` on decorative elements.
- **Zero `dangerouslySetInnerHTML`**: Verified across all source files.

---

## 2. Signature Memorable Element: "Visibility Skyline" (`HazeSkyline`)

Traditional AQI apps default to alarmist gauges. BreatheWise features an atmospheric depth attenuation visualizer (`src/components/HazeSkyline.tsx`):

- 4-layer flat SVG city skyline (monuments, mid-rise commercial blocks, neighborhood trees/roofs, street-level foreground).
- Layer opacities attenuate deterministically with CPCB air categories:
  - **Good**: All 4 layers crisp (layer 4: 0.95, layer 1: 1.0)
  - **Moderate**: Distant horizon softened (layer 4: 0.40, layer 3: 0.80)
  - **Very Poor**: Horizon obscured, mid-rise faint (layer 4: 0.0, layer 3: 0.20, layer 2: 0.65)
  - **Severe**: Only immediate foreground silhouette remains visible through dense smog (layers 4 & 3: 0.0, layer 2: 0.25, layer 1: 1.0).
- 900 ms smooth reveal transition on first render, immediately disabled under `@media (prefers-reduced-motion: reduce)`.
- Strictly marked `aria-hidden="true"` with plain text equivalents in the hero card.

---

## 3. Two-Tier Advice & Conversational Experience

1. **Fast-Path Initial Render**: `/api/advice` renders verified physical calculations and built-in scientific explanations immediately with zero layout shift.
2. **In-Place AI Upgrade**: Asynchronously calls `/api/explain` to upgrade narrative explanations to "Written by Google Gemma 4 31B IT". If the LLM is delayed or fails, built-in explanations are silently preserved.
3. **Quarantined Assistant (`AskPanel`)**:
   - 3 suggested prompt chips.
   - 300-character input cap with live counter.
   - Grounded strictly in current advice snapshot.
   - Automatic rate-limit countdown timer on HTTP 429.

---

## 4. Source File Length Ceiling Invariant

Every file in `src/` strictly adheres to the $<250$ line limit:

| File                                   | Lines | Purpose                                |
| -------------------------------------- | ----- | -------------------------------------- |
| `src/core/dayplan.ts`                  | 248   | Diurnal window solver                  |
| `src/adapters/openaq.ts`               | 245   | OpenAQ sensor client                   |
| `src/core/types.ts`                    | 244   | Core Zod contracts                     |
| `src/adapters/jarvislabs-gemma.ts`     | 242   | Gemma 4 31B IT adapter                 |
| `src/components/LocationPicker.tsx`    | 215   | ARIA 1.2 combobox                      |
| `src/components/DayTimeline.tsx`       | 184   | 24h schedule & calendar links          |
| `src/components/AirNowHero.tsx`        | 152   | Opaque hero panel & PM2.5 display      |
| `src/app/page.tsx`                     | 148   | Responsive layout shell                |
| `src/app/about/page.tsx`               | 145   | Transparent methodology & assumptions  |
| `src/components/HouseholdForm.tsx`     | 143   | Collapsible household preferences form |
| `src/components/OutlookLine.tsx`       | 141   | 24-hour forecast & trendline           |
| `src/components/HouseholdYourHome.tsx` | 144   | Residence & purifier fieldset          |
| `src/components/HouseholdFields.tsx`   | 135   | Demographics & commute fieldsets       |
| `src/components/HazeSkyline.tsx`       | 131   | 4-layer visibility attenuation SVG     |
| `src/lib/useAdvice.ts`                 | 114   | Two-tier advice fetch lifecycle hook   |
| `src/components/AppShell.tsx`          | 115   | Skip link, header, bottom nav          |
| `src/components/ActionItem.tsx`        | 94    | Ranked intervention card               |
| `src/components/DescribeHousehold.tsx` | 88    | Natural language parsing textarea      |
| `src/components/LevelMeter.tsx`        | 85    | 6-step discrete level meter            |
| `src/server/profile-draft.ts`          | 65    | Step 0 extracted profile draft module  |
| `src/app/api/parse-profile/route.ts`   | 43    | Thin route wrapper (<60 lines)         |

---

## 5. Build & Performance Results

- **Next.js Production Build (`npm run build`)**: Passing in **1.48 s**.
- **First Load JS**:
  - `/` (Home): **142 kB** (meets requirement $\le 150\text{ kB}$).
  - `/about`: **106 kB**.
  - `/_not-found`: **103 kB**.
- **Typecheck (`tsc --noEmit`)**: Clean (0 errors).
- **Linter (`eslint .`)**: Clean (0 errors, 0 warnings).
- **Test Suite (`npm test`)**: **42 test files, 395 tests, 100% passing**.
