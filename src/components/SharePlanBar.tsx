"use client";

import React, { useState } from "react";
import type { AdviceResponse } from "@/core/response";
import type { Language } from "@/core/types";
import { buildShareSummary } from "@/core/share";
import { t } from "@/lib/i18n";

export interface SharePlanBarProps {
  advice: AdviceResponse;
  language: Language;
}

export function SharePlanBar({ advice, language }: SharePlanBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const summary = buildShareSummary(advice, language);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summary)}`;

  const handleNativeShareOrCopy = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("app.title", undefined, language),
          text: summary,
        });
        setFeedback(t("ui.share.copied", undefined, language));
        return;
      } catch (err) {
        // User cancelled or aborted native share; proceed to clipboard copy fallback
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    // Fallback: Copy to clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summary);
        setFeedback(t("ui.share.copied", undefined, language));
        setTimeout(() => setFeedback(null), 4000);
      } catch {
        setFeedback(t("ui.share.copyFailed", undefined, language));
      }
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <section
      aria-labelledby="share-plan-title"
      className="no-print my-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="share-plan-title"
          className="text-sm font-semibold uppercase tracking-wider text-stone-700"
        >
          {t("ui.share.title", undefined, language)}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Native Share / Copy */}
          <button
            type="button"
            onClick={handleNativeShareOrCopy}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="mr-1.5">
              📤
            </span>
            {t("ui.share.sharePlan", undefined, language)}
          </button>

          {/* WhatsApp Direct */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="mr-1.5">
              💬
            </span>
            {t("ui.share.shareWhatsApp", undefined, language)}
            <span className="sr-only"> {t("ui.dayplan.opensNewTab", undefined, language)}</span>
          </a>

          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="mr-1.5">
              🖨️
            </span>
            {t("ui.share.printPlan", undefined, language)}
          </button>
        </div>
      </div>

      {/* Accessible polite notification for clipboard feedback */}
      <div
        role="status"
        aria-live="polite"
        className="mt-2 text-xs font-medium text-emerald-700 empty:hidden"
      >
        {feedback}
      </div>
    </section>
  );
}
