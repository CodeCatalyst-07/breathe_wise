"use client";

import React from "react";
import Link from "next/link";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";

interface DataSourcesFooterProps {
  onClearDetails?: () => void;
  language?: Language;
}

export const DataSourcesFooter: React.FC<DataSourcesFooterProps> = ({
  onClearDetails,
  language = "en",
}) => {
  return (
    <footer className="w-full bg-paper border-t border-line mt-12 py-8 px-4 sm:px-8 text-xs text-ink-muted flex flex-col gap-6">
      {/* Safety & Medical Disclaimers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-panel bg-surface border border-line">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-ink">⚠️ Engineering Advisory</p>
          <p className="leading-relaxed">
            {t("safety.disclaimer.general_guidance", undefined, language)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-mark-very-poor">🚨 Medical Guidance</p>
          <p className="leading-relaxed">
            {t("safety.medical.seek_help_for_symptoms", undefined, language)}
          </p>
        </div>
      </div>

      {/* Attributions & Links */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{t("attributions.openaq", undefined, language)}</span>
          <span>•</span>
          <span>{t("attributions.cams", undefined, language)}</span>
          <span>•</span>
          <span>{t("attributions.gemma", undefined, language)}</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/about"
            className="font-medium text-action hover:underline focus-visible:ring-2 rounded"
          >
            {t("ui.nav.about", undefined, language)}
          </Link>

          {onClearDetails && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("ui.household.clearConfirm", undefined, language))) {
                  onClearDetails();
                }
              }}
              className="font-medium text-mark-very-poor hover:underline focus-visible:ring-2 rounded"
            >
              {t("ui.household.clearButton", undefined, language)}
            </button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-ink-muted/80 text-center pt-2">
        BreatheWise does not track your location or store private health data. All profile inputs
        are held strictly in your browser session.
      </div>
    </footer>
  );
};
