"use client";

import React from "react";
import type { AdviceActionItem, AdviceExplanation } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { ActionItem } from "./ActionItem";

interface ActionListProps {
  actions: AdviceActionItem[];
  explanation?: AdviceExplanation;
  language?: Language;
}

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  explanation,
  language = "en",
}) => {
  const householdActions = actions.filter((a) => a.group === "household");

  if (householdActions.length === 0) return null;

  const topAction = householdActions[0];
  const secondaryActions = householdActions.slice(1);

  const getAiText = (actionId: string) => {
    return explanation?.perAction.find((p) => p.actionId === actionId)?.text;
  };

  return (
    <section aria-labelledby="actions-heading" className="flex flex-col gap-5 w-full">
      <header className="flex flex-col gap-1">
        <h2 id="actions-heading" className="text-xl sm:text-2xl font-serif font-bold text-ink">
          {t("ui.actions.title", undefined, language)}
        </h2>
        <p className="text-sm text-ink-muted">{t("ui.actions.subtitle", undefined, language)}</p>
      </header>

      {/* Top Ranked Feature Card */}
      {topAction && (
        <ActionItem
          item={topAction}
          aiExplanationText={getAiText(topAction.result.actionId)}
          isTopRanked={true}
          language={language}
        />
      )}

      {/* Secondary Compact Actions List */}
      {secondaryActions.length > 0 && (
        <div className="flex flex-col gap-4">
          {secondaryActions.map((item) => (
            <ActionItem
              key={item.result.actionId}
              item={item}
              aiExplanationText={getAiText(item.result.actionId)}
              isTopRanked={false}
              language={language}
            />
          ))}
        </div>
      )}
    </section>
  );
};
