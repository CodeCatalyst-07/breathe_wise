# Core Domain Layer (Pure Decision Engine)

This directory houses the pure, deterministic decision and calculation engine of BreatheWise.

## Principles & Invariants

- **Zero I/O**: No network calls, no HTTP clients, no database drivers.
- **Zero Environment Leakage**: No access to `process.env`.
- **Zero Hidden State**: No direct calls to `Date.now()` or `Math.random()`; all time and data are explicitly injected via parameters.
- **Honesty Rule**: No scientific numbers are invented. Authorised parameters are explicitly documented in `coefficients.ts`. Unsupported parameters have `null` values with status `"needs-source"`, and dependent actions return qualitative `displayMode: "directional"` or `"myth-check"`.
- **Explain-Only Guarantee**: GenAI receives computed `ImpactResult` objects and only synthesizes human-readable explanations; the LLM never invents numbers.

---

## Module Map

| Module                                                                                          | Responsibility                                                                                       | Key Exports                                                                                  |
| :---------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| [`coefficients.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/coefficients.ts)           | Authorised physical and empirical modeling constants with source and confidence tags.                | `COEFFICIENTS`, `getAssumptions()`, `getNonSourcedCoefficients()`                            |
| [`aqi.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/aqi.ts)                             | CPCB PM2.5 scale categorization, WHO 24h exceedance ratio, and linear AQI sub-index interpolation.   | `getAqiCategory()`, `calculateAqiNumber()`, `getWhoExceedanceRatio()`, `categorizeReading()` |
| [`indoor.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/indoor.ts)                       | Steady-state single-compartment indoor mass-balance model and ACH-based purifier sizing.             | `calculateIndoorConcentration()`, `recommendPurifierCadr()`                                  |
| [`exposure.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/exposure.ts)                   | Microenvironment daily schedule validation and time-weighted average PM2.5 exposure integration.     | `validateSchedule()`, `calculateTimeWeightedExposure()`                                      |
| [`actions.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/actions.ts)                     | Action definitions cataloguing numeric, directional, and myth-check interventions.                   | `ACTIONS`, `getActionById()`, `ActionDefinition`                                             |
| [`action-evaluators.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/action-evaluators.ts) | Evaluation logic for numeric actions ensuring $\Delta_{low} \le \Delta_{likely} \le \Delta_{high}$.  | `evaluateHepaPurifier()`, `evaluateKeepWindowsClosed()`, `evaluateVentilateAtCleanestHour()` |
| [`rules.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/rules.ts)                         | Selector applying vulnerability monotonicity and conservative safety floor when data is unavailable. | `selectRuleActions()`, `SAFETY_DISCLAIMER_KEY`, `SAFETY_MEDICAL_KEY`                         |
| [`rules-table.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/rules-table.ts)             | Data table mapping AQI categories to base and vulnerable action priority rankings.                   | `RULES_BY_CATEGORY`, `RuleEntry`                                                             |
| [`ranking.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/ranking.ts)                     | Deterministic ranking by policy priority, numeric delta magnitude, budget, and stable tie-break.     | `rankActions()`, `RankedAction`                                                              |
| [`numbers.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/numbers.ts)                     | Devanagari digit normalization and whitelist guard rejecting LLM hallucinations.                     | `collectAllowedNumbers()`, `findDisallowedNumbers()`, `normalizeDevanagariDigits()`          |
| [`types.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/types.ts)                         | Canonical domain schemas and inferred TypeScript types with Zod validation.                          | `HouseholdProfileSchema`, `ImpactResultSchema`, `AqiReading`                                 |
| [`ports.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/ports.ts)                         | Abstract provider interfaces and typed functional `Result<T, E>` container.                          | `Result`, `ok()`, `err()`, `AirQualityProvider`, `LlmClient`                                 |
| [`index.ts`](file:///Users/arnav/Desktop/BreatheWise/src/core/index.ts)                         | Central re-export barrel for the entire pure core package.                                           | Re-exports all core domain contracts and algorithms.                                         |
