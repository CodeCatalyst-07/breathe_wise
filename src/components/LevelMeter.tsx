"use client";

import React from "react";
import type { AqiCategoryLevel } from "@/core/types";
import { t } from "@/lib/i18n";
import type { Language } from "@/core/types";

interface LevelMeterProps {
  category: AqiCategoryLevel;
  language?: Language;
}

const CATEGORIES: AqiCategoryLevel[] = [
  "good",
  "satisfactory",
  "moderate",
  "poor",
  "very_poor",
  "severe",
];

const CATEGORY_COLORS: Record<AqiCategoryLevel, string> = {
  good: "#1E7F5C",
  satisfactory: "#5B7815",
  moderate: "#946A00",
  poor: "#D2571F",
  very_poor: "#B3243A",
  severe: "#6B1B3A",
};

export const LevelMeter: React.FC<LevelMeterProps> = ({ category, language = "en" }) => {
  const currentIndex = CATEGORIES.indexOf(category);
  const activeIndex = currentIndex >= 0 ? currentIndex : 2;
  const activeColor = CATEGORY_COLORS[category] || "#946A00";
  const categoryLabel = t(`aqi.category.${category}`, undefined, language);

  const ariaText = t(
    "ui.hero.levelMeterLabel",
    {
      current: activeIndex + 1,
      total: CATEGORIES.length,
      category: categoryLabel,
    },
    language,
  );

  return (
    <div role="img" aria-label={ariaText} className="flex flex-col gap-1.5 w-full max-w-md">
      <div className="flex items-center gap-1.5 w-full">
        {CATEGORIES.map((cat, idx) => {
          const isSelected = idx === activeIndex;
          const isLowerOrEqual = idx <= activeIndex;
          return (
            <div
              key={cat}
              className="flex-1 h-2 rounded-cell transition-all duration-300"
              style={{
                backgroundColor: isSelected
                  ? activeColor
                  : isLowerOrEqual
                    ? `${activeColor}40`
                    : "#D8E2E6",
                transform: isSelected ? "scaleY(1.4)" : "scaleY(1)",
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between items-center text-xs text-ink-muted">
        <span>{t("aqi.category.good", undefined, language)}</span>
        <span className="font-semibold" style={{ color: activeColor }}>
          {categoryLabel} ({activeIndex + 1}/{CATEGORIES.length})
        </span>
        <span>{t("aqi.category.severe", undefined, language)}</span>
      </div>
    </div>
  );
};
