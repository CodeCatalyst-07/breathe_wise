import { COEFFICIENTS, collectAllowedNumbers, WHO_PM25_24H_GUIDELINE } from "@/core";
import type { AdviceExplanation, AdviceResponse, AssumptionItem, ImpactResult } from "@/core";

export function aggregateAssumptions(impacts: readonly ImpactResult[]): AssumptionItem[] {
  const seen = new Set<string>();
  const list: AssumptionItem[] = [];

  for (const imp of impacts) {
    for (const key of imp.assumptions) {
      if (seen.has(key)) continue;
      seen.add(key);

      const bareKey = key.replace(/^assumptions\./, "");
      const coef =
        COEFFICIENTS[bareKey] ??
        Object.values(COEFFICIENTS).find((c) => c.key === bareKey || c.key === key);

      list.push({
        key,
        status: coef?.status ?? "assumption",
        confidence: coef?.confidence ?? "low",
        source: coef?.source ?? "Modeller assumption - verify before citing",
        description: coef?.description ?? key,
      });
    }
  }

  return list;
}

export function collectPipelineAllowedNumbers(advice: AdviceResponse): Set<number> {
  const extras: number[] = [advice.airQuality.reading.pm25, WHO_PM25_24H_GUIDELINE];

  if (advice.outlook.cleanestHour) {
    extras.push(advice.outlook.cleanestHour.pm25, advice.outlook.cleanestHour.hourLocal);
  }
  if (advice.outlook.worstHour) {
    extras.push(advice.outlook.worstHour.pm25, advice.outlook.worstHour.hourLocal);
  }
  if (advice.outlook.next12hAvg !== undefined) extras.push(advice.outlook.next12hAvg);
  if (advice.outlook.following12hAvg !== undefined) extras.push(advice.outlook.following12hAvg);
  if (advice.outlook.difference !== undefined) extras.push(advice.outlook.difference);

  for (let h = 0; h <= 24; h++) extras.push(h);
  for (let r = 1; r <= advice.actions.length; r++) extras.push(r);

  for (const slot of advice.dayPlan.slots) {
    extras.push(slot.hourLocal, slot.pm25);
  }

  if (advice.dayPlan.bestOutdoorWindow) {
    extras.push(
      advice.dayPlan.bestOutdoorWindow.avgPm25,
      advice.dayPlan.bestOutdoorWindow.startHourLocal,
      advice.dayPlan.bestOutdoorWindow.endHourLocal,
    );
  }
  if (advice.dayPlan.bestVentilationWindow) {
    extras.push(
      advice.dayPlan.bestVentilationWindow.avgPm25,
      advice.dayPlan.bestVentilationWindow.startHourLocal,
      advice.dayPlan.bestVentilationWindow.endHourLocal,
    );
  }

  return collectAllowedNumbers(
    advice.actions.map((a) => a.result),
    extras,
  );
}

export function buildGroundingSummary(advice: AdviceResponse): string {
  const aq = advice.airQuality.reading;
  const lines = [
    `Location: ${advice.location.label}`,
    `Observed PM2.5: ${aq.pm25} ug/m3 (${aq.category})`,
    `Outlook Trend: ${advice.outlook.status}`,
  ];

  if (advice.outlook.cleanestHour) {
    lines.push(
      `Cleanest Hour: ${advice.outlook.cleanestHour.hourLocal}:00 with ${advice.outlook.cleanestHour.pm25} ug/m3`,
    );
  }
  if (advice.dayPlan.bestOutdoorWindow) {
    lines.push(
      `Best Outdoor Window: ${advice.dayPlan.bestOutdoorWindow.startHourLocal}:00-${advice.dayPlan.bestOutdoorWindow.endHourLocal}:00`,
    );
  }
  if (advice.dayPlan.bestVentilationWindow) {
    lines.push(
      `Best Ventilation Window: ${advice.dayPlan.bestVentilationWindow.startHourLocal}:00-${advice.dayPlan.bestVentilationWindow.endHourLocal}:00`,
    );
  }

  lines.push("Top Recommended Actions:");
  for (const a of advice.actions.slice(0, 5)) {
    const delta =
      a.result.displayMode === "numeric" && a.result.deltaLikely !== undefined
        ? `reduces PM2.5 by ~${a.result.deltaLikely} ug/m3`
        : (a.result.direction ?? "beneficial");
    lines.push(`- ${a.result.actionId}: ${delta}`);
  }

  return lines.join("\n");
}

export function buildBuiltinAiFallbackExplanation(advice: AdviceResponse): AdviceExplanation {
  return {
    source: "builtin",
    summary: `Air quality status is ${advice.airQuality.reading.category}. Follow the prioritized routine actions below to minimize toxic exposure.`,
    perAction: advice.actions.map((a) => ({
      actionId: a.result.actionId,
      text: `${a.builtinExplanation.whatToDoKey}: ${a.builtinExplanation.whyItMattersKey}`,
    })),
  };
}
