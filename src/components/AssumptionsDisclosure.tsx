"use client";

import React, { useState } from "react";
import type { ConfidenceLevel, Language } from "@/core/types";
import { t } from "@/lib/i18n";

interface AssumptionsDisclosureProps {
  assumptions: string[];
  confidence: ConfidenceLevel;
  language?: Language;
}

export const AssumptionsDisclosure: React.FC<AssumptionsDisclosureProps> = ({
  assumptions,
  confidence,
  language = "en",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!assumptions || assumptions.length === 0) return null;

  const confidenceText = t(`confidence.${confidence}`, undefined, language);

  return (
    <div className="pt-2 border-t border-line/50">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-action hover:underline focus-visible:ring-2 rounded"
      >
        <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
        <span>{t("ui.actions.howWeWorkedThisOut", undefined, language)}</span>
        <span className="text-[11px] text-ink-muted">({confidenceText})</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-paper/60 rounded-control border border-line text-xs text-ink flex flex-col gap-2">
          <p className="font-semibold text-ink-muted">
            {t("ui.actions.confidence", undefined, language)}: {confidenceText}
          </p>
          <ul className="list-disc pl-4 flex flex-col gap-1 text-ink-muted">
            {assumptions.map((assumpKey) => {
              const cleanKey = assumpKey.startsWith("assumptions.")
                ? assumpKey
                : `assumptions.${assumpKey}`;
              return <li key={assumpKey}>{t(cleanKey, undefined, language)}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
