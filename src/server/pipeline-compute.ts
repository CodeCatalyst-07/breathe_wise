import {
  calculateIndoorConcentration,
  categorizeReading,
  forecastOutlook,
  getActionById,
  HouseholdProfileSchema,
  planCalendarEvents,
  planDay,
  rankActions,
  selectRuleActions,
} from "@/core";
import type {
  ActionContext,
  ActionWithRule,
  AdviceActionItem,
  AdviceResponse,
  ApplicationError,
  Location,
  Result,
} from "@/core";
import { err, ok } from "@/core";
import { buildBuiltinExplanations } from "@/core/explain-builtin";
import { aggregateAssumptions } from "./pipeline-helpers";
import type { AdviceRequest, PipelineDependencies } from "./pipeline-types";

function roundCoordinate(val: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

export function buildUnavailableAdvice(
  profile: typeof HouseholdProfileSchema._type,
  now: string,
  lat: number,
  lng: number,
  label: string,
): AdviceResponse {
  const rules = selectRuleActions(profile, "poor", false);
  const actions: AdviceActionItem[] = rules.map((r, idx) => ({
    result: {
      actionId: r.actionId,
      displayMode: "directional",
      direction: "reduces",
      assumptions: ["assumptions.air_quality_unavailable_conservative_floor"],
      sources: ["CPCB Safety Floor Policy"],
      confidence: "low",
    },
    rank: idx + 1,
    reasonKey: r.reasonKey,
    builtinExplanation: {
      actionId: r.actionId,
      whatToDoKey: `builtin_explanations.${r.actionId}.what_to_do`,
      whyItMattersKey: `builtin_explanations.${r.actionId}.why_it_matters`,
      assumptionsKeys: ["assumptions.air_quality_unavailable_conservative_floor"],
    },
    group: getActionById(r.actionId)?.group ?? "household",
  }));

  return {
    generatedAt: now,
    timezone: "UTC",
    location: { label, roundedLat: roundCoordinate(lat, 2), roundedLng: roundCoordinate(lng, 2) },
    dataStatus: "unavailable",
    airQuality: {
      reading: {
        pm25: 0,
        concentration: 0,
        category: "poor",
        kind: "model",
        basis: "instantaneous",
        labelKey: "aqi.category.poor",
        basisLabelKey: "aqi.basis.instantaneous",
        ordinal: 3,
      },
      provenance: "unavailable",
      attributions: [],
    },
    outlook: { status: "unavailable", thresholdUsed: 15 },
    dayPlan: { dataStatus: "forecast_unavailable", slots: [], avoidWindows: [] },
    calendarEvents: [],
    actions,
    assumptions: [],
    safety: {
      disclaimerKey: "safety.disclaimer.general_guidance",
      medicalHelpKey: "safety.medical.seek_help_for_symptoms",
    },
  };
}

export async function computeAdviceData(
  deps: PipelineDependencies,
  request: AdviceRequest,
): Promise<Result<AdviceResponse, ApplicationError>> {
  const parse = HouseholdProfileSchema.safeParse(request.profile);
  if (!parse.success) {
    return err({ code: "validation_error", message: parse.error.message });
  }
  const profile = parse.data;
  const now = request.now ?? (deps.clock ? deps.clock.nowIso() : new Date().toISOString());
  const lat = roundCoordinate(profile.location.lat, 4);
  const lng = roundCoordinate(profile.location.lng, 4);
  const label = profile.location.label ?? "Local Region";

  const loc: Location = { lat, lng, label };
  const [aqRes, weatherRes] = await Promise.all([
    deps.airQuality.getAirQuality(loc),
    deps.weather ? deps.weather.getWeather(loc) : Promise.resolve(undefined),
  ]);

  if (!aqRes.ok) {
    return ok(buildUnavailableAdvice(profile, now, lat, lng, label));
  }

  const aq = aqRes.value as typeof aqRes.value & {
    reading?: { pm25: number; category: string; kind: "measured" | "model" };
    provenance?: string;
    attributions?: string[];
  };
  const weather = weatherRes?.ok ? weatherRes.value : undefined;
  const timezone = aq.timezone ?? weather?.timezone ?? "UTC";

  const rawPm25 = aq.reading?.pm25 ?? aq.pm25;
  const rawKind = aq.reading?.kind ?? aq.kind ?? "model";
  const catRes = categorizeReading({
    concentration: rawPm25,
    kind: rawKind,
    basis: "instantaneous",
  });

  const reading = {
    pm25: rawPm25,
    concentration: rawPm25,
    category: catRes.ok ? catRes.value.category : ("poor" as const),
    kind: rawKind,
    basis: "instantaneous" as const,
    labelKey: catRes.ok ? catRes.value.labelKey : "aqi.category.poor",
    basisLabelKey: "aqi.basis.instantaneous",
    ordinal: catRes.ok ? catRes.value.ordinal : 3,
  };

  const indoorRes = calculateIndoorConcentration({
    outdoorPm25: rawPm25,
    roomVolumeM3: profile.home.roomVolumeM3 ?? 45,
    airExchangeRatePerHour: 0.6,
    purifierCadrM3h: profile.home.purifierCadrM3h ?? 0,
  });
  const indoorLikely = indoorRes.ok ? indoorRes.value.likely : undefined;

  const ctx: ActionContext = {
    airQuality: {
      pm25: rawPm25,
      source: aq.source === "openaq" ? "openaq" : "open-meteo",
      observedAt: aq.observedAt ?? now,
      kind: rawKind,
      hourlyForecast: aq.hourlyForecast ?? [],
    },
    weather,
  };

  const rules = selectRuleActions(profile, reading.category, true);
  const actionsWithRules: ActionWithRule[] = [];

  for (const rule of rules) {
    const action = getActionById(rule.actionId);
    if (action && action.appliesTo(profile, ctx)) {
      const evalRes = action.evaluate(profile, ctx);
      if (evalRes.ok) {
        actionsWithRules.push({ rule, impactResult: evalRes.value });
      }
    }
  }

  const ranked = rankActions(actionsWithRules, profile);

  const dayPlan = planDay({
    now,
    timezone,
    hourlyForecast: aq.hourlyForecast ?? [],
    weather,
    profile,
    indoorLikely,
  });

  const outlook = forecastOutlook(aq.hourlyForecast ?? [], timezone);
  const calendarEvents = planCalendarEvents(dayPlan, timezone, profile.language);
  const builtin = buildBuiltinExplanations(ranked, dayPlan, outlook, reading);

  const actions: AdviceActionItem[] = ranked.map((r) => {
    const def = getActionById(r.actionId);
    const b = builtin.perAction.find((p) => p.actionId === r.actionId) ?? {
      actionId: r.actionId,
      whatToDoKey: `builtin_explanations.${r.actionId}.what_to_do`,
      whyItMattersKey: `builtin_explanations.${r.actionId}.why_it_matters`,
      assumptionsKeys: [...r.impactResult.assumptions],
    };
    return {
      result: r.impactResult,
      rank: r.rank,
      reasonKey: r.reasonKey,
      builtinExplanation: {
        ...b,
        assumptionsKeys: [...b.assumptionsKeys],
      },
      group: def?.group ?? "household",
    };
  });

  return ok({
    requestId: request.requestId,
    generatedAt: now,
    timezone,
    location: { label, roundedLat: roundCoordinate(lat, 2), roundedLng: roundCoordinate(lng, 2) },
    dataStatus: "available",
    airQuality: {
      reading,
      provenance: aq.provenance ?? aq.source ?? "open-meteo",
      attributions: aq.attributions ?? ["OpenAQ", "Copernicus"],
      divergence: aq.divergence,
    },
    outlook,
    dayPlan: {
      dataStatus: dayPlan.dataStatus,
      slots: [...dayPlan.slots],
      bestOutdoorWindow: dayPlan.bestOutdoorWindow,
      bestVentilationWindow: dayPlan.bestVentilationWindow,
      avoidWindows: [...dayPlan.avoidWindows],
    },
    calendarEvents: [...calendarEvents],
    actions,
    assumptions: aggregateAssumptions(ranked.map((r) => r.impactResult)),
    safety: {
      disclaimerKey: "safety.disclaimer.general_guidance",
      medicalHelpKey: "safety.medical.seek_help_for_symptoms",
    },
  });
}
