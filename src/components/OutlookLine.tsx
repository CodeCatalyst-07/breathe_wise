"use client";

import React from "react";
import type { ForecastOutlookModel, DayPlanModel } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { formatNumber, formatHour } from "@/lib/formatters";

interface OutlookLineProps {
  outlook: ForecastOutlookModel;
  dayPlan: DayPlanModel;
  language?: Language;
}

export const OutlookLine: React.FC<OutlookLineProps> = ({ outlook, dayPlan, language = "en" }) => {
  const { status, cleanestHour, worstHour } = outlook;
  const statusKey = `ui.outlook.${status}`;
  const statusSentence = t(statusKey, undefined, language);

  const slots = dayPlan.slots || [];
  const maxPm = slots.reduce((m: number, s) => Math.max(m, s.pm25), 100);
  const minPm = slots.reduce((m: number, s) => Math.min(m, s.pm25), 0);
  const range = Math.max(1, maxPm - minPm);

  const points = slots.map((s, i: number) => {
    const x = (i / Math.max(1, slots.length - 1)) * 300;
    const y = 50 - ((s.pm25 - minPm) / range) * 40;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const sparklinePath = points.length > 0 ? `M ${points.join(" L ")}` : "";

  return (
    <section
      aria-labelledby="outlook-heading"
      className="w-full bg-surface rounded-panel border border-line p-5 sm:p-6 flex flex-col gap-4 shadow-sm"
    >
      <header className="flex flex-col gap-1">
        <h2 id="outlook-heading" className="text-lg font-serif font-bold text-ink">
          {t("ui.outlook.title", undefined, language)}
        </h2>
        <p className="text-sm font-medium text-ink-muted">{statusSentence}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
        {cleanestHour && (
          <div className="flex items-center gap-2 p-3 rounded-control bg-tint-good/50 border border-mark-good/30 text-ink">
            <span className="text-mark-good font-bold text-base" aria-hidden="true">
              ↓
            </span>
            <span>
              {t(
                "ui.outlook.cleanestHour",
                {
                  hour: formatHour(cleanestHour.hourLocal),
                  pm25: formatNumber(cleanestHour.pm25, language),
                },
                language,
              )}
            </span>
          </div>
        )}

        {worstHour && (
          <div className="flex items-center gap-2 p-3 rounded-control bg-tint-severe/40 border border-mark-severe/30 text-ink">
            <span className="text-mark-severe font-bold text-base" aria-hidden="true">
              ↑
            </span>
            <span>
              {t(
                "ui.outlook.worstHour",
                {
                  hour: formatHour(worstHour.hourLocal),
                  pm25: formatNumber(worstHour.pm25, language),
                },
                language,
              )}
            </span>
          </div>
        )}
      </div>

      {slots.length > 1 && (
        <div aria-hidden="true" className="w-full h-16 pt-2">
          <svg
            viewBox="0 0 300 55"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            <path
              d={sparklinePath}
              fill="none"
              stroke="#0B6E8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex justify-between text-[11px] text-ink-muted pt-1">
            <span>{formatHour(slots[0]?.hourLocal ?? 0)}</span>
            <span>{formatHour(slots[Math.floor(slots.length / 2)]?.hourLocal ?? 12)}</span>
            <span>{formatHour(slots[slots.length - 1]?.hourLocal ?? 23)}</span>
          </div>
        </div>
      )}

      <div className="sr-only">
        <table>
          <caption>{t("ui.outlook.tableSummary", undefined, language)}</caption>
          <thead>
            <tr>
              <th scope="col">{t("ui.outlook.hour", undefined, language)}</th>
              <th scope="col">{t("ui.outlook.pm25", undefined, language)}</th>
              <th scope="col">{t("ui.outlook.category", undefined, language)}</th>
              <th scope="col">{t("ui.outlook.outdoor", undefined, language)}</th>
              <th scope="col">{t("ui.outlook.ventilation", undefined, language)}</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.timestamp}>
                <td>{formatHour(s.hourLocal)}</td>
                <td>{s.pm25} µg/m³</td>
                <td>{s.category}</td>
                <td>{s.outdoorActivity}</td>
                <td>{s.ventilationOk ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
