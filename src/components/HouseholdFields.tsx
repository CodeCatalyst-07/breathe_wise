"use client";

import React from "react";
import {
  ChildrenAgeBandSchema,
  CommuteModeSchema,
  type HouseholdProfile,
  type ChildrenAgeBand,
  type CommuteMode,
  type Language,
} from "@/core/types";
import { t } from "@/lib/i18n";

export interface FieldsetProps {
  formData: HouseholdProfile;
  setFormData: React.Dispatch<React.SetStateAction<HouseholdProfile>>;
  language?: Language;
}

export const WhoLivesHereFieldset: React.FC<FieldsetProps> = ({
  formData,
  setFormData,
  language = "en",
}) => {
  const handleChildrenToggle = (band: ChildrenAgeBand) => {
    const current = formData.household.childrenAgeBands;
    const next = current.includes(band) ? current.filter((b) => b !== band) : [...current, band];
    setFormData({
      ...formData,
      household: { ...formData.household, childrenAgeBands: next },
    });
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-ink">
        {t("ui.household.whoLivesHere", undefined, language)}
      </legend>
      <div className="flex flex-col gap-2 text-xs">
        <span className="font-medium text-ink-muted">
          {t("ui.household.childrenAgeBands", undefined, language)}
        </span>
        <div className="flex flex-wrap gap-2">
          {ChildrenAgeBandSchema.options.map((band) => {
            const isChecked = formData.household.childrenAgeBands.includes(band);
            return (
              <label
                key={band}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-xs cursor-pointer select-none transition-colors"
                style={{
                  borderColor: isChecked ? "var(--color-action)" : "var(--color-line)",
                  backgroundColor: isChecked ? "var(--color-paper)" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleChildrenToggle(band)}
                  className="rounded"
                />
                <span>Age {band}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-1 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.household.hasElderly}
            onChange={(e) =>
              setFormData({
                ...formData,
                household: { ...formData.household, hasElderly: e.target.checked },
              })
            }
          />
          <span>{t("ui.household.elderly", undefined, language)}</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.household.hasRespiratoryCondition}
            onChange={(e) =>
              setFormData({
                ...formData,
                household: {
                  ...formData.household,
                  hasRespiratoryCondition: e.target.checked,
                },
              })
            }
          />
          <span>{t("ui.household.respiratory", undefined, language)}</span>
        </label>
      </div>
    </fieldset>
  );
};

export const CommuteFieldset: React.FC<FieldsetProps> = ({
  formData,
  setFormData,
  language = "en",
}) => {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-ink">
        {t("ui.household.howYouTravel", undefined, language)}
      </legend>
      <label htmlFor="commute-select" className="text-xs text-ink-muted">
        {t("ui.household.commuteMode", undefined, language)}
      </label>
      <select
        id="commute-select"
        value={formData.commuteMode}
        onChange={(e) => setFormData({ ...formData, commuteMode: e.target.value as CommuteMode })}
        className="px-3 py-2 rounded-control border border-line bg-surface text-ink text-xs focus:border-action"
      >
        {CommuteModeSchema.options.map((mode) => (
          <option key={mode} value={mode}>
            {mode.replace(/_/g, " ").toUpperCase()}
          </option>
        ))}
      </select>
    </fieldset>
  );
};
