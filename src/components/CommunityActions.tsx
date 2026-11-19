"use client";

import React from "react";
import type { AdviceActionItem, AdviceExplanation } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { ActionItem } from "./ActionItem";

interface CommunityActionsProps {
  actions: AdviceActionItem[];
  explanation?: AdviceExplanation;
  language?: Language;
}

export const CommunityActions: React.FC<CommunityActionsProps> = ({
  actions,
  explanation,
  language = "en",
}) => {
  const communityActions = actions.filter((a) => a.group === "community");

  if (communityActions.length === 0) return null;

  const getAiText = (actionId: string) => {
    return explanation?.perAction.find((p) => p.actionId === actionId)?.text;
  };

  return (
    <section aria-labelledby="community-heading" className="flex flex-col gap-4 w-full">
      <header className="flex flex-col gap-1">
        <h2 id="community-heading" className="text-xl sm:text-2xl font-serif font-bold text-ink">
          {t("ui.community.title", undefined, language)}
        </h2>
        <p className="text-sm text-ink-muted">{t("ui.community.subtitle", undefined, language)}</p>
      </header>

      <div className="flex flex-col gap-4">
        {communityActions.map((item) => (
          <ActionItem
            key={item.result.actionId}
            item={item}
            aiExplanationText={getAiText(item.result.actionId)}
            isTopRanked={false}
            language={language}
          />
        ))}
      </div>
    </section>
  );
};
