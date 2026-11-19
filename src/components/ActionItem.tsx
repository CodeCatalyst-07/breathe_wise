"use client";

import React from "react";
import type { AdviceActionItem } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { ImpactDisplay } from "./ImpactDisplay";
import { AssumptionsDisclosure } from "./AssumptionsDisclosure";

interface ActionItemProps {
  item: AdviceActionItem;
  aiExplanationText?: string;
  isTopRanked?: boolean;
  language?: Language;
}

export const ActionItem: React.FC<ActionItemProps> = ({
  item,
  aiExplanationText,
  isTopRanked = false,
  language = "en",
}) => {
  const { result, rank, reasonKey, builtinExplanation } = item;
  const actionId = result.actionId;

  const label = t(`actions.${actionId}.label`, undefined, language);
  const description = t(`actions.${actionId}.description`, undefined, language);
  const cleanReasonKey = reasonKey.startsWith("reasons.") ? reasonKey : `reasons.${reasonKey}`;
  const reasonText = t(cleanReasonKey, undefined, language);

  return (
    <article
      className={`rounded-panel border transition-shadow duration-150 p-5 sm:p-6 flex flex-col gap-4 ${
        isTopRanked
          ? "bg-surface border-action shadow-md ring-1 ring-action/20"
          : "bg-surface border-line shadow-sm hover:border-ink-muted/40"
      }`}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isTopRanked ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-chip text-xs font-bold uppercase tracking-wider bg-action text-white">
              ⭐ {t("ui.actions.topIntervention", undefined, language)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-ink-muted">
              #{rank} {t("ui.actions.otherInterventions", undefined, language)}
            </span>
          )}

          {aiExplanationText ? (
            <span className="text-[11px] font-medium text-action bg-action/10 px-2 py-0.5 rounded-chip">
              {t("ui.actions.aiBadge", undefined, language)}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-ink-muted bg-paper px-2 py-0.5 rounded-chip border border-line">
              {t("ui.actions.builtinBadge", undefined, language)}
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-serif font-bold text-ink">{label}</h3>
        <p className="text-xs sm:text-sm text-ink-muted">{description}</p>
      </header>

      <ImpactDisplay result={result} language={language} />

      <div className="text-xs sm:text-sm text-ink bg-paper/40 p-3.5 rounded-control border border-line/60 flex flex-col gap-1.5">
        {aiExplanationText ? (
          <p className="leading-relaxed">{aiExplanationText}</p>
        ) : (
          <>
            <p className="font-medium">
              {t(builtinExplanation.whatToDoKey, builtinExplanation.params, language)}
            </p>
            <p className="text-ink-muted leading-relaxed">
              {t(builtinExplanation.whyItMattersKey, builtinExplanation.params, language)}
            </p>
          </>
        )}
        <p className="text-[11px] text-ink-muted italic pt-1">{reasonText}</p>
      </div>

      <AssumptionsDisclosure
        assumptions={result.assumptions}
        confidence={result.confidence}
        language={language}
      />
    </article>
  );
};
