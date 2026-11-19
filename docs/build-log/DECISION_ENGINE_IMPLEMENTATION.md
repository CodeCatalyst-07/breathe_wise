# Pure Decision Engine Implementation (BreatheWise)

The pure decision engine for **BreatheWise** is implemented and tested. It strictly complies with the **Honesty Rule**, architectural boundaries, and pure functional constraints:

- **Zero I/O & Environment Isolation:** No network calls, no HTTP clients, no `process.env`, and no direct calls to `Date.now()` or `Math.random()`.
- **Explain-Only GenAI Contract:** The LLM receives pre-computed `ImpactResult` objects and only synthesizes human-readable explanations; it never calculates or hallucinates numbers.
- **Honesty Rule Enforced:** All numerical parameters reside in [coefficients.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/coefficients.ts). Parameters lacking authorised scientific backing are set to `null` with status `"needs-source"`, and dependent actions return qualitative `displayMode: "directional"` or `"myth-check"` without inventing numeric deltas.
- **Strict Typing & High Quality:** Small files (<250 lines each), 100% functional purity, TSDoc on every export, zero `any` types, and **97.26% line coverage** across `src/core/`.

---

## 1. File Tree of Changes

```text
/Users/arnav/Desktop/BreatheWise/
├── docs/
│   └── ARCHITECTURE.md                 # Updated with Core engine pipeline section
├── package.json                        # Added @vitest/coverage-v8, fast-check, test:coverage script
├── src/
│   ├── core/
│   │   ├── README.md                   # Updated comprehensive module map & purity invariants
│   │   ├── action-evaluators.ts        # Modular numeric action evaluation routines (<250 lines)
│   │   ├── actions.ts                  # Action catalogue (9 numeric, directional & myth-check actions)
│   │   ├── aqi.ts                      # CPCB continuous bands, WHO exceedance ratio, linear sub-index
│   │   ├── coefficients.ts             # Authorised parameters registry & Honesty Rule enforcement
│   │   ├── exposure.ts                 # DaySchedule validation & hourly time-weighted exposure integration
│   │   ├── index.ts                    # Re-exports all core contracts and algorithms
│   │   ├── indoor.ts                   # Steady-state single-compartment model & purifier sizing
│   │   ├── numbers.ts                  # Devanagari digit normalization & LLM number whitelist guard
│   │   ├── ports.ts                    # Abstract provider ports & typed functional Result container
│   │   ├── ranking.ts                  # Deterministic multi-factor ranking & explainable reasonKeys
│   │   ├── rules-table.ts              # Compact category x vulnerability rule priority matrix
│   │   ├── rules.ts                    # Policy rules selector, safety floor, & vulnerability monotonicity
│   │   └── types.ts                    # Minimal additive contract changes (DisplayMode, QualitativeDirection, AqiReading, DaySchedule)
│   └── i18n/
│       └── en.json                     # English translation keys for categories, actions, reasons, assumptions & safety
└── tests/
    └── unit/
        ├── actions.test.ts             # Tests for all 9 actions (numeric bounds, directional, myth-check)
        ├── aqi.test.ts                 # Table-driven category boundary tests (0..600 ug/m3) & WHO ratios
        ├── coefficients.test.ts        # Tests for assumptions registry & needs-source null values
        ├── exposure.test.ts            # DaySchedule overlap validation & hand-computed arithmetic fixtures
        ├── fixtures/
        │   └── profiles.ts             # 4 golden scenario fixtures (infant, elderly, commuter, offline)
        ├── golden.test.ts              # End-to-end golden pipeline assertions across 4 distinct profiles
        ├── index.test.ts               # Asserts complete re-export coverage of core modules
        ├── indoor.test.ts              # Hand-computed arithmetic tests & fast-check property tests
        ├── numbers.test.ts             # Devanagari numerals, ranges, thousands separators, & rejection tests
        ├── purity.test.ts              # AST/regex test: 92 assertions verifying zero I/O across src/core
        ├── ranking.test.ts             # Multi-tier deterministic sorting & explainable reasonKeys
        └── rules.test.ts               # Full category x group rules snapshot & monotonicity properties
```

---

## 2. List of Contract Changes to `types.ts` & `ports.ts`

Only minimal, additive, and backwards-compatible changes were introduced:

1. **`DisplayModeSchema` & `DisplayMode`** ([types.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts#L143-L144)):
   - Added `z.enum(["numeric", "directional", "myth-check"])`.
2. **`QualitativeDirectionSchema` & `QualitativeDirection`** ([types.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts#L147-L153)):
   - Added `z.enum(["reduces", "likely_reduces", "neutral", "ineffective"])`.
3. **`ImpactResultSchema` Additive Extension** ([types.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts#L159-L208)):
   - Added `displayMode: DisplayModeSchema.default("numeric")`.
   - Added `direction: QualitativeDirectionSchema.optional()`.
   - Made `baseline`, `scenario`, `deltaLow`, `deltaLikely`, `deltaHigh`, `unit` optional when `displayMode !== "numeric"`.
   - When `displayMode === "numeric"`, the refinement enforces that all 6 fields are present and `deltaLow <= deltaLikely && deltaLikely <= deltaHigh`. All previous unit tests continue to pass without modification.
4. **AQI Reading Contracts** ([types.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts#L211-L236)):
   - Added `AqiCategoryLevelSchema` & `AqiCategoryLevel` (`"good" | "satisfactory" | "moderate" | "poor" | "very_poor" | "severe"`).
   - Added `AqiBasisSchema` & `AqiBasis` (`"instantaneous" | "24h_average"`).
   - Added `AqiReading` interface tracking concentration, category, AQI number, kind, basis, `labelKey`, `basisLabelKey`, and `ordinal`.
5. **Daily Schedule Contracts** ([types.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts#L239-L260)):
   - Added `EnvironmentTypeSchema` & `EnvironmentType` (`"outdoor" | "commute" | "indoor"`).
   - Added `ScheduleSegmentSchema` & `ScheduleSegment` with interval validation.
   - Added `DayScheduleSchema` & `DaySchedule`.
6. **`ports.ts`**:
   - Preserved existing `Result<T, E>` and provider port interfaces without breaking changes.

---

## 3. Non-"Sourced" Coefficients (Assumptions & Needs-Source Table)

Per the **Honesty Rule**, only the WHO 24-hour PM2.5 guideline (15 µg/m³) is marked `"sourced"`. All other parameters are explicitly logged as assumptions or `"needs-source"` (values set to `null`):

| Key                               |  Low   | Likely |  High  |     Unit      |     Status     | Confidence | Source / Note                                                                                         |
| :-------------------------------- | :----: | :----: | :----: | :-----------: | :------------: | :--------: | :---------------------------------------------------------------------------------------------------- |
| `penetrationFactor`               |  0.7   |  0.85  |  1.0   | dimensionless |  `assumption`  |   `low`    | Modeller assumption — verify before citing                                                            |
| `airExchangeClosed`               |  0.3   |  0.6   |  1.0   |      1/h      |  `assumption`  |   `low`    | Modeller assumption — verify before citing                                                            |
| `airExchangeOpen`                 |  1.5   |  3.0   |  6.0   |      1/h      |  `assumption`  |   `low`    | Modeller assumption — verify before citing                                                            |
| `depositionRate`                  |  0.1   |  0.3   |  0.5   |      1/h      |  `assumption`  |   `low`    | Modeller assumption — verify before citing                                                            |
| `purifierTargetACH`               |  4.0   |  4.5   |  5.0   |      1/h      |  `assumption`  |   `low`    | General purifier-sizing rule of thumb                                                                 |
| `aqiTopBandConcentration`         | 380.0  | 450.0  | 500.0  |     µg/m³     |  `assumption`  |   `low`    | CPCB 401–500 scale linear extrapolation assumption                                                    |
| `defaultRoomVolumeM3`             |  30.0  |  45.0  |  70.0  |      m³       |  `assumption`  |   `low`    | Modeller assumption — typical urban bedroom volume                                                    |
| `maskFiltrationEfficiency`        | `null` | `null` | `null` |       %       | `needs-source` |   `low`    | Needs independent fit testing certification (e.g. NIOSH N95 / EN149 FFP2); action is directional only |
| `travelModeExposureRatio`         | `null` | `null` | `null` | dimensionless | `needs-source` |   `low`    | City-specific route & microenvironment study needed; action is directional only                       |
| `cookingVentilationEffectiveness` | `null` | `null` | `null` |       %       | `needs-source` |   `low`    | Kitchen geometry & exhaust flow rate dependent; action is directional only                            |
| `plantAirCleaningRate`            | `null` | `null` | `null` |     m³/h      | `needs-source` |   `low`    | Peer-reviewed literature shows houseplant phytoremediation is negligible in real rooms                |
| `biomassBurningContribution`      | `null` | `null` | `null` |     µg/m³     | `needs-source` |   `low`    | Hyperlocal source apportionment data required; action is directional only                             |

Accessible via `getNonSourcedCoefficients()` and `getAssumptions()` in [coefficients.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/coefficients.ts).

---

## 4. Verification & Coverage Results

### `npm run check` Output

```text
> urban-air-quality-assistant@0.1.0 check
> npm run lint && npm run typecheck && npm run test

> urban-air-quality-assistant@0.1.0 lint
> eslint .

> urban-air-quality-assistant@0.1.0 typecheck
> tsc --noEmit

> urban-air-quality-assistant@0.1.0 test
> vitest run

 RUN  v3.2.7 /Users/arnav/Desktop/BreatheWise

 ✓ tests/unit/purity.test.ts (92 tests) 5ms
 ✓ tests/unit/coefficients.test.ts (5 tests) 2ms
 ✓ tests/unit/aqi.test.ts (20 tests) 5ms
 ✓ tests/unit/ranking.test.ts (4 tests) 14ms
 ✓ tests/security/env.test.ts (4 tests) 3ms
 ✓ tests/unit/numbers.test.ts (7 tests) 4ms
 ✓ tests/unit/indoor.test.ts (10 tests) 10ms
 ✓ tests/unit/exposure.test.ts (8 tests) 8ms
 ✓ tests/unit/golden.test.ts (4 tests) 13ms
 ✓ tests/unit/rules.test.ts (6 tests) 4ms
 ✓ tests/unit/actions.test.ts (11 tests) 5ms
 ✓ tests/unit/household-profile.test.ts (4 tests) 5ms
 ✓ tests/unit/impact-result.test.ts (5 tests) 6ms
 ✓ tests/unit/logger.test.ts (3 tests) 2ms
 ✓ tests/unit/index.test.ts (1 test) 2ms
 ✓ tests/unit/errors.test.ts (4 tests) 3ms

 Test Files  16 passed (16)
      Tests  188 passed (188)
   Start at  09:16:45
   Duration  606ms (transform 331ms, setup 0ms, collect 787ms, tests 90ms, environment 2ms, prepare 749ms)
```

### `npm run test:coverage` Output

```text
> urban-air-quality-assistant@0.1.0 test:coverage
> vitest run --coverage

 RUN  v3.2.7 /Users/arnav/Desktop/BreatheWise
      Coverage enabled with v8

 Test Files  16 passed (16)
      Tests  188 passed (188)
   Start at  09:16:50
   Duration  746ms

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    84.8 |    82.18 |   83.33 |    84.8 |
 ...eWise/src/core |   97.26 |    83.33 |     100 |   97.26 |
  ...evaluators.ts |   93.67 |    65.21 |     100 |   93.67 | ...,97-98,143-144
  actions.ts       |     100 |      100 |     100 |     100 |
  aqi.ts           |   95.71 |    86.84 |     100 |   95.71 | ...96-197,200-201
  coefficients.ts  |     100 |      100 |     100 |     100 |
  exposure.ts      |   90.22 |    80.48 |     100 |   90.22 | ...73,132-133,191
  index.ts         |     100 |      100 |     100 |     100 |
  indoor.ts        |   96.24 |     73.8 |     100 |   96.24 | 153-157
  numbers.ts       |    97.8 |     90.9 |     100 |    97.8 | 137-138
  ports.ts         |     100 |      100 |     100 |     100 |
  ranking.ts       |   95.12 |    94.73 |     100 |   95.12 | 66-67
  rules-table.ts   |     100 |      100 |     100 |     100 |
  rules.ts         |     100 |    93.75 |     100 |     100 | 54
  types.ts         |   97.94 |       50 |     100 |   97.94 | 173-174,177
-------------------|---------|----------|---------|---------|-------------------
```

---

## 5. Architectural & Design Decisions

1. **Modular Sub-Division for <250 Lines Compliance:**
   - To keep every file under 250 lines while maintaining exhaustive type annotations and documentation:
     - Split action evaluation routines into [action-evaluators.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/action-evaluators.ts) (203 lines) while keeping [actions.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/actions.ts) (144 lines) focused on cataloguing and applying definitions.
     - Separated the policy priority matrix into [rules-table.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/rules-table.ts) (72 lines), keeping [rules.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/rules.ts) (74 lines) dedicated to selector logic and safety floors.
2. **Deterministic Indoor Uncertainty Bounds ($low \le likely \le high$):**
   - In [indoor.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/indoor.ts), lower concentration bounds are calculated using the cleanest physical parameter triplet (lower penetration $P_{low} = 0.7$, higher deposition $k_{high} = 0.5$). The highest concentration bound evaluates the worst combination ($P_{high} = 1.0$, $k_{low} = 0.1$). This guarantees that calculated indoor concentrations and resulting action reductions strictly satisfy $low \le likely \le high$.
3. **Commute Exposure under Honesty Rule:**
   - Because no travel-mode exposure reduction factor was authorised (status: `"needs-source"`), commute exposure in [exposure.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/exposure.ts) defaults to ambient outdoor PM2.5, explicitly tagged with the assumption key `"exposure.commute_assumes_ambient_outdoor"`. The commute switching action is evaluated as qualitative `displayMode: "directional"` without fabricating arbitrary percentage drops.
4. **Number Whitelist Domain Token Protection:**
   - In [numbers.ts](file:///Users/arnav/Desktop/BreatheWise/src/core/numbers.ts), domain identifiers such as `PM2.5`, `PM10`, mask designations (`N95`, `FFP2`, `KN95`), volumetric units (`m³`, `µg/m³`), range hyphens (`150-170`), and Gregorian calendar years (`2026`) are pre-masked or normalized before token matching. This avoids false-positive rejections while detecting any hallucinated reduction figures.
