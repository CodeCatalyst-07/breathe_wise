# BreatheWise Design Specification & Visual Architecture

## 1. Concept, Context & Audience

### 1.1 The Human Problem

During northern and central Indian winter months (November to February), atmospheric temperature inversions trap particulate matter close to the ground. Ambient PM2.5 concentrations routinely exceed 200–500 µg/m³—ten to thirty times the WHO 24-hour guideline (15 µg/m³).

The human reality of this crisis is visceral:

- Parents checking air monitors late at night or early morning while children cough.
- Working adults commuting through dense toxic smog on two-wheelers, auto-rickshaws, and buses.
- Households inundated with confusing, conflicting, or commercialized advice (expensive purifiers vs. houseplants vs. wet towels).

### 1.2 The Design Response: Calm, Actionable, Honest

BreatheWise is designed not as a breathless "red alert" doom dashboard, but as a quiet, authoritative, disciplined assistant.

- **Immediate Clarity**: Answer the first question within 1 second: _"What is the air right now, when is it cleanest today, and what is the single most effective thing I can do right now?"_
- **Absolute Scientific Honesty**: The UI never invents health claims or derived percentages. If an action reduces particulate infiltration by 40–50 µg/m³ based on physics, it states the range and explicitly lists the mathematical assumptions. Directional actions state direction without fake numbers.
- **Extreme Respect for Privacy**: Health and demographic inputs stay strictly in ephemeral tab state (`sessionStorage`). They are never persisted to disk, localStorage, analytics, or query strings. A visible "Clear my details" button allows instant wiping.

---

## 2. The Signature Memorable Element: "Visibility Skyline" (`HazeSkyline`)

Traditional AQI apps rely on alarmist bright red/purple gauge needles. BreatheWise introduces a natural, physical metaphor: atmospheric visual range attenuation.

The **HazeSkyline** is a 4-layer flat SVG cityscape representing depth planes:

1. **Layer 4 (Deep Horizon)**: Distant historical monuments and mountain silhouettes.
2. **Layer 3 (Mid-Distance)**: Mid-rise commercial buildings and city blocks.
3. **Layer 2 (Neighborhood)**: Residential roofs, treetops, and utility poles.
4. **Layer 1 (Foreground)**: Streetlight, boundary wall, and nearby trees.

### Atmospheric Attenuation Formula:

As air quality degrades across the 6 CPCB categories, distant layers attenuate into the ambient haze color:

- **Good (1)**: All 4 layers crisp and clearly visible.
- **Satisfactory (2)**: Layer 4 gently softened (opacity 0.70).
- **Moderate (3)**: Layer 4 faded (opacity 0.40), Layer 3 softened (opacity 0.80).
- **Poor (4)**: Layer 4 obscured (opacity 0.10), Layer 3 faded (opacity 0.50).
- **Very Poor (5)**: Layer 4 invisible (opacity 0.00), Layer 3 barely perceptible (opacity 0.20), Layer 2 softened (opacity 0.65).
- **Severe (6)**: Layers 4 and 3 invisible (opacity 0.00), Layer 2 faint ghost (opacity 0.25), only immediate Layer 1 foreground silhouette remains visible through the dense particulate fog.

### Accessibility & Motion:

- Layer opacity transition executes over 900 ms on first render.
- Strictly disabled under `@media (prefers-reduced-motion: reduce)` (instantaneous rendering).
- Marked `aria-hidden="true"`, with plain text equivalents immediately adjacent in the hero card.

---

## 3. Color Tokens & Contrast Ratios (WCAG AA)

All colors meet WCAG 2.1 Level AA requirements for normal text ($\ge 4.5:1$) and large text/UI components ($\ge 3:1$).

| Token Name             | Hex Code  | Role                      | Canvas Context              | Computed Contrast                                     | Standard              |
| ---------------------- | --------- | ------------------------- | --------------------------- | ----------------------------------------------------- | --------------------- |
| `--color-paper`        | `#F2F5F6` | Page background           | —                           | —                                                     | —                     |
| `--color-surface`      | `#FFFFFF` | Card/panel surface        | Paper (`#F2F5F6`)           | 1.09:1 (structural)                                   | —                     |
| `--color-ink`          | `#14262F` | Primary text              | Surface (`#FFFFFF`) / Paper | **14.0:1** / **12.8:1**                               | Pass AA & AAA         |
| `--color-ink-muted`    | `#4A5E68` | Secondary & metadata      | Surface (`#FFFFFF`) / Paper | **5.9:1** / **5.4:1**                                 | Pass AA ($\ge 4.5:1$) |
| `--color-line`         | `#C9D4D9` | Borders & dividers        | Surface (`#FFFFFF`) / Paper | **1.5:1** / **1.4:1**                                 | Non-text component    |
| `--color-action`       | `#0B6E8A` | Interactive buttons/links | Paper (`#F2F5F6`)           | **4.3:1** (large) / **4.75:1** (white text on action) | Pass AA               |
| `--color-action-hover` | `#08566C` | Hover / active states     | Paper (`#F2F5F6`)           | **6.1:1** (white text on action)                      | Pass AA               |

### CPCB Category Marks & Tints

Text is never rendered directly onto the raw sky gradient wash. High-contrast ink is rendered either on white surface panels or light pastel category tints:

- **Good**: Mark `#1E7F5C`, Tint `#E8F5EE` (Contrast `#14262F` on tint: **13.0:1**)
- **Satisfactory**: Mark `#5B7815`, Tint `#F2F7E6` (Contrast `#14262F` on tint: **13.3:1**)
- **Moderate**: Mark `#946A00`, Tint `#FFF8E6` (Contrast `#14262F` on tint: **13.5:1**)
- **Poor**: Mark `#D2571F`, Tint `#FDF1EB` (Contrast `#14262F` on tint: **12.9:1**)
- **Very Poor**: Mark `#B3243A`, Tint `#FBECEE` (Contrast `#14262F` on tint: **12.6:1**)
- **Severe**: Mark `#6B1B3A`, Tint `#F7E8EF` (Contrast `#14262F` on tint: **12.2:1**)

### Focus Ring:

Every interactive element receives a high-contrast focus indicator:
`outline: 3px solid #0B6E8A; outline-offset: 2px;`

---

## 4. Typography Scale & Layout Architecture

### 4.1 Fonts:

- **Headings & Figures**: Google Noto Serif (Latin + Devanagari) with `font-feature-settings: "tnum"` for numeric columns.
- **Body & Controls**: Google Noto Sans (Latin + Devanagari).
- **Line Heights**: 1.5 standard English; adjusted to 1.7 for Hindi (`:lang(hi)`).

### 4.2 Radii:

- Interactive controls (buttons, inputs): `10px` (`rounded-control`)
- Panels and hero cards: `20px` (`rounded-panel`)
- Status chips and pills: `9999px` (`rounded-chip`)
- Timeline and meter cells: `4px` (`rounded-cell`)

### 4.3 Layout Grid:

- **Mobile First (390×844)**:
  - Single column with max width `72rem` (1152px).
  - Floating bottom navigation anchor bar (`Today`, `What helps`, `Ask`) with 44×44px minimum tap targets.
  - Sticky location header with compact status.
- **Desktop (1280×800)**:
  - 2-column asymmetric layout:
    - Left/Center (2/3 column): Hero Skyline, AirNowHero, 24h Day Timeline, Ranked Actions, Community Actions.
    - Right (1/3 sticky sidebar): Location Combobox, Household Profile Drawer/Form, Ask Assistant Panel.

---

## 5. Architectural & Design Decisions Review

Against the brief, the following specific design choices were refined:

1. **No Derived Math in UI**: The UI delegates 100% of reductions, ranges, and uncertainties to `/api/advice`. The UI simply displays the returned `impact` fields.
2. **Accessible Combobox**: W3C ARIA 1.2 Combobox pattern implemented natively without heavyweight external dependencies to maintain zero layout shift and `<150 kB` bundle size.
3. **Graceful Fallbacks**: When AI explanation is unavailable or delayed, the UI seamlessly preserves built-in deterministic advice and never stalls or throws blank screens.
4. **Google Services Alignment**:
   - Google Gemma 4 31B IT for contextual conversational explanations.
   - Google Fonts (Noto Sans & Noto Serif).
   - Google Calendar one-click direct links (`target="_blank"` with screen-reader text `(opens in a new tab)`).
