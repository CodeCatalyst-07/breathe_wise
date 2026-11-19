"use client";

import React from "react";
import type { DayPlanModel, CalendarEventModel } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { formatTime, formatNumber } from "@/lib/formatters";
import { CalendarLinks } from "./CalendarLinks";

interface DayTimelineProps {
  dayPlan: DayPlanModel;
  calendarEvents: CalendarEventModel[];
  timezone: string;
  language?: Language;
}

const CATEGORY_BAR_COLOR: Record<string, string> = {
  good: "#1E7F5C",
  satisfactory: "#5B7815",
  moderate: "#946A00",
  poor: "#D2571F",
  very_poor: "#B3243A",
  severe: "#6B1B3A",
};

export const DayTimeline: React.FC<DayTimelineProps> = ({
  dayPlan,
  calendarEvents,
  timezone,
  language = "en",
}) => {
  const { slots, bestOutdoorWindow, bestVentilationWindow, avoidWindows } = dayPlan;

  return (
    <section
      aria-labelledby="timeline-heading"
      className="w-full bg-surface rounded-panel border border-line p-5 sm:p-6 flex flex-col gap-5 shadow-sm"
    >
      <header className="flex flex-col gap-1">
        <h2 id="timeline-heading" className="text-lg font-serif font-bold text-ink">
          {t("ui.dayplan.title", undefined, language)}
        </h2>
        <p className="text-sm font-medium text-ink-muted">
          {t("ui.dayplan.subtitle", undefined, language)}
        </p>
      </header>

      {/* 24-Hour Visual Color Strip (strictly aria-hidden) */}
      {slots && slots.length > 0 && (
        <div aria-hidden="true" className="flex flex-col gap-1 w-full">
          <div className="flex h-5 w-full rounded-cell overflow-hidden border border-line/60">
            {slots.map((slot) => {
              const color = CATEGORY_BAR_COLOR[slot.category] || "#946A00";
              return (
                <div
                  key={slot.timestamp}
                  style={{ backgroundColor: color }}
                  className="flex-1 h-full transition-opacity hover:opacity-80"
                  title={`${slot.hourLocal}:00 — ${slot.pm25} µg/m³ (${slot.category})`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-ink-muted px-0.5">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}

      {/* Semantic Accessible List of Windows */}
      <ol className="flex flex-col gap-3">
        {bestOutdoorWindow && (
          <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-control bg-tint-good/40 border border-mark-good/30 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="text-mark-good font-bold text-base" aria-hidden="true">
                🏃
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {t(bestOutdoorWindow.labelKey, undefined, language)}
                </p>
                <p className="text-xs text-ink-muted">
                  {t(bestOutdoorWindow.reasonKey, undefined, language)}
                </p>
              </div>
            </div>
            <div className="text-xs font-medium text-ink sm:text-right whitespace-nowrap">
              <time dateTime={bestOutdoorWindow.startLocalIso}>
                {formatTime(bestOutdoorWindow.startLocalIso, timezone, language)}
              </time>
              {" — "}
              <time dateTime={bestOutdoorWindow.endLocalIso}>
                {formatTime(bestOutdoorWindow.endLocalIso, timezone, language)}
              </time>
              {bestOutdoorWindow.avgPm25 !== undefined && (
                <span className="block text-ink-muted font-normal">
                  ~{formatNumber(bestOutdoorWindow.avgPm25, language)} µg/m³
                </span>
              )}
            </div>
          </li>
        )}

        {bestVentilationWindow && (
          <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-control bg-tint-satisfactory/40 border border-mark-satisfactory/30 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="text-mark-satisfactory font-bold text-base" aria-hidden="true">
                🪟
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {t(bestVentilationWindow.labelKey, undefined, language)}
                </p>
                <p className="text-xs text-ink-muted">
                  {t(bestVentilationWindow.reasonKey, undefined, language)}
                </p>
              </div>
            </div>
            <div className="text-xs font-medium text-ink sm:text-right whitespace-nowrap">
              <time dateTime={bestVentilationWindow.startLocalIso}>
                {formatTime(bestVentilationWindow.startLocalIso, timezone, language)}
              </time>
              {" — "}
              <time dateTime={bestVentilationWindow.endLocalIso}>
                {formatTime(bestVentilationWindow.endLocalIso, timezone, language)}
              </time>
              {bestVentilationWindow.avgPm25 !== undefined && (
                <span className="block text-ink-muted font-normal">
                  ~{formatNumber(bestVentilationWindow.avgPm25, language)} µg/m³
                </span>
              )}
            </div>
          </li>
        )}

        {avoidWindows &&
          avoidWindows.map((avoid, idx) => (
            <li
              key={`${avoid.startLocalIso}-${idx}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-control bg-tint-poor/30 border border-mark-poor/30 text-sm"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-mark-poor font-bold text-base" aria-hidden="true">
                  🛑
                </span>
                <div>
                  <p className="font-semibold text-ink">{t(avoid.labelKey, undefined, language)}</p>
                  <p className="text-xs text-ink-muted">
                    {t(avoid.reasonKey, undefined, language)}
                  </p>
                </div>
              </div>
              <div className="text-xs font-medium text-ink sm:text-right whitespace-nowrap">
                <time dateTime={avoid.startLocalIso}>
                  {formatTime(avoid.startLocalIso, timezone, language)}
                </time>
                {" — "}
                <time dateTime={avoid.endLocalIso}>
                  {formatTime(avoid.endLocalIso, timezone, language)}
                </time>
                {avoid.avgPm25 !== undefined && (
                  <span className="block text-ink-muted font-normal">
                    ~{formatNumber(avoid.avgPm25, language)} µg/m³
                  </span>
                )}
              </div>
            </li>
          ))}
      </ol>

      <CalendarLinks events={calendarEvents} language={language} />
    </section>
  );
};
