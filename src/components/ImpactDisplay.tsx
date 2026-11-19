"use client";

import React from "react";
import type { ImpactResult, Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/formatters";

interface ImpactDisplayProps {
  result: ImpactResult;
  language?: Language;
}

export const ImpactDisplay: React.FC<ImpactDisplayProps> = ({ result, language = "en" }) => {
  const { displayMode, direction, deltaLikely, deltaLow, deltaHigh, baseline, scenario } = result;

  if (displayMode !== "numeric" || deltaLikely === undefined) {
    const directionLabel =
      direction === "reduces"
        ? "Reduces exposure"
        : direction === "likely_reduces"
          ? "Likely reduces exposure"
          : "Protective habit";

    return (
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-action bg-action/10 px-2.5 py-1 rounded-control w-fit">
        <span>🛡️</span>
        <span>{t("ui.actions.directionalEffect", { direction: directionLabel }, language)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-xs sm:text-sm">
      <div className="flex flex-wrap items-baseline gap-2 font-semibold text-action">
        <span className="text-base sm:text-lg">↓ ~{formatNumber(deltaLikely, language)} µg/m³</span>
        {deltaLow !== undefined && deltaHigh !== undefined && (
          <span className="text-xs font-normal text-ink-muted">
            (
            {t(
              "ui.actions.reductionRange",
              {
                low: formatNumber(deltaLow, language),
                high: formatNumber(deltaHigh, language),
              },
              language,
            )}
            )
          </span>
        )}
      </div>

      {baseline !== undefined && scenario !== undefined && (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>
            {t("ui.actions.baselineIndoor", { value: formatNumber(baseline, language) }, language)}
          </span>
          <span aria-hidden="true">→</span>
          <span className="font-medium text-ink">
            {t("ui.actions.projectedIndoor", { value: formatNumber(scenario, language) }, language)}
          </span>
        </div>
      )}
    </div>
  );
};
