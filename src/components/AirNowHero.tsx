"use client";

import React from "react";
import type { AirQualitySummarySchema, LocationSummary } from "@/core/response";
import type { z } from "zod";
import type { Language } from "@/core/types";
import { WHO_PM25_24H_GUIDELINE } from "@/core/aqi";
import { t } from "@/lib/i18n";
import { formatNumber, formatTime } from "@/lib/formatters";
import { HazeSkyline } from "./HazeSkyline";
import { LevelMeter } from "./LevelMeter";

type AirQualitySummary = z.infer<typeof AirQualitySummarySchema>;

interface AirNowHeroProps {
  airQuality: AirQualitySummary;
  location: LocationSummary;
  generatedAt: string;
  timezone: string;
  language?: Language;
}

const CATEGORY_SKY_CLASS: Record<string, string> = {
  good: "bg-sky-good",
  satisfactory: "bg-sky-satisfactory",
  moderate: "bg-sky-moderate",
  poor: "bg-sky-poor",
  very_poor: "bg-sky-very-poor",
  severe: "bg-sky-severe",
};

const CATEGORY_TINT_BORDER: Record<string, string> = {
  good: "#1E7F5C",
  satisfactory: "#5B7815",
  moderate: "#946A00",
  poor: "#D2571F",
  very_poor: "#B3243A",
  severe: "#6B1B3A",
};

const CATEGORY_ICONS: Record<string, string> = {
  good: "🍃",
  satisfactory: "🌱",
  moderate: "🌤️",
  poor: "😷",
  very_poor: "🚨",
  severe: "🛑",
};

export const AirNowHero: React.FC<AirNowHeroProps> = ({
  airQuality,
  location,
  generatedAt,
  timezone,
  language = "en",
}) => {
  const { reading, provenance, divergence } = airQuality;
  const category = reading.category;
  const skyClass = CATEGORY_SKY_CLASS[category] || "bg-sky-moderate";
  const markColor = CATEGORY_TINT_BORDER[category] || "#946A00";

  const whoMultiple = Math.max(1, Math.round(reading.pm25 / WHO_PM25_24H_GUIDELINE));
  const localizedCategory = t(`aqi.category.${category}`, undefined, language);

  return (
    <section
      aria-labelledby="hero-heading"
      className={`relative w-full rounded-panel overflow-hidden border border-line shadow-sm transition-colors duration-500 ${skyClass}`}
    >
      {/* Decorative Haze Skyline */}
      <HazeSkyline category={category} className="absolute inset-x-0 bottom-0 opacity-80" />

      {/* Main Opaque Foreground Surface Strip */}
      <div className="relative z-10 m-4 sm:m-6 p-6 sm:p-8 bg-surface/95 backdrop-blur-md rounded-panel border border-line/60 shadow-sm flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-muted">
            {location.label}
          </p>
          <h1 id="hero-heading" className="text-xl sm:text-2xl font-serif font-bold text-ink">
            {t(
              "ui.hero.airRightNow",
              { place: location.label, category: localizedCategory },
              language,
            )}
          </h1>
        </header>

        {/* PM2.5 Large Display */}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
          <div className="flex items-baseline gap-2">
            <span
              className="font-serif font-bold tracking-tight text-display text-ink"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {formatNumber(reading.pm25, language)}
            </span>
            <span className="text-base sm:text-lg font-medium text-ink-muted">
              {t("ui.hero.pm25Unit", undefined, language)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-chip text-sm font-semibold border"
              style={{
                borderColor: markColor,
                color: markColor,
                backgroundColor: `${markColor}15`,
              }}
            >
              <span aria-hidden="true">{CATEGORY_ICONS[category] || "⚠️"}</span>
              <span>{localizedCategory}</span>
            </span>
            <span className="text-xs sm:text-sm font-medium text-ink-muted">
              {t("ui.hero.whoGuideline", { multiple: whoMultiple }, language)}
            </span>
          </div>
        </div>

        {/* Discrete Level Meter */}
        <LevelMeter category={category} language={language} />

        {/* Provenance & Timestamp Metadata */}
        <footer className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/60 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: markColor }}
              aria-hidden="true"
            />
            <span>{provenance}</span>
          </div>
          <time dateTime={generatedAt}>
            {t(
              "ui.hero.updatedAt",
              { time: formatTime(generatedAt, timezone, language) },
              language,
            )}
          </time>
        </footer>

        {/* Divergence Warning if Ground Sensor and Regional Model Disagree */}
        {divergence?.isDivergent && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3 rounded-control bg-tint-moderate border border-mark-moderate/40 text-xs text-ink"
          >
            <span className="text-mark-moderate font-bold text-sm" aria-hidden="true">
              ⚠️
            </span>
            <span>
              {t("ui.hero.divergenceWarning", { ratio: divergence.ratio.toFixed(1) }, language)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
