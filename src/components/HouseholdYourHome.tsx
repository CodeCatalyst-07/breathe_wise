"use client";

import React from "react";
import {
  WindowsHabitSchema,
  CookingFuelSchema,
  type HouseholdProfile,
  type WindowsHabit,
  type CookingFuel,
  type Language,
} from "@/core/types";
import { t } from "@/lib/i18n";
import { PurifierPhotoReader } from "./PurifierPhotoReader";

export interface YourHomeFieldsetProps {
  formData: HouseholdProfile;
  setFormData: React.Dispatch<React.SetStateAction<HouseholdProfile>>;
  hasPurifier: boolean;
  setHasPurifier: (has: boolean) => void;
  language?: Language;
}

export const YourHomeFieldset: React.FC<YourHomeFieldsetProps> = ({
  formData,
  setFormData,
  hasPurifier,
  setHasPurifier,
  language = "en",
}) => {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-ink">
        {t("ui.household.yourHome", undefined, language)}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <label htmlFor="windows-habit-select" className="text-ink-muted">
            {t("ui.household.windowsHabit", undefined, language)}
          </label>
          <select
            id="windows-habit-select"
            value={formData.home.windowsHabit}
            onChange={(e) =>
              setFormData({
                ...formData,
                home: { ...formData.home, windowsHabit: e.target.value as WindowsHabit },
              })
            }
            className="px-3 py-2 rounded-control border border-line bg-surface text-ink text-xs focus:border-action"
          >
            {WindowsHabitSchema.options.map((hab) => (
              <option key={hab} value={hab}>
                {hab.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cooking-fuel-select" className="text-ink-muted">
            {t("ui.household.cookingFuel", undefined, language)}
          </label>
          <select
            id="cooking-fuel-select"
            value={formData.home.cookingFuel}
            onChange={(e) =>
              setFormData({
                ...formData,
                home: { ...formData.home, cookingFuel: e.target.value as CookingFuel },
              })
            }
            className="px-3 py-2 rounded-control border border-line bg-surface text-ink text-xs focus:border-action"
          >
            {CookingFuelSchema.options.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel.replace(/_/g, " ").toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasPurifier}
            onChange={(e) => setHasPurifier(e.target.checked)}
          />
          <span className="font-medium text-ink">
            {t("ui.household.purifierOwned", undefined, language)}
          </span>
        </label>

        {hasPurifier && (
          <div className="flex flex-col gap-1 pl-6">
            <label htmlFor="cadr-input" className="text-ink-muted">
              {t("ui.household.purifierCadr", undefined, language)}
            </label>
            <input
              id="cadr-input"
              type="number"
              min="50"
              max="1200"
              value={formData.home.purifierCadrM3h || 250}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  home: { ...formData.home, purifierCadrM3h: Number(e.target.value) },
                })
              }
              className="px-3 py-1.5 rounded-control border border-line bg-surface text-ink text-xs max-w-xs focus:border-action"
            />
            <span className="text-[11px] text-ink-muted">
              {t("ui.household.purifierCadrHelp", undefined, language)}
            </span>

            <div className="mt-2 max-w-sm">
              <PurifierPhotoReader
                language={language}
                onApplyCadr={(cadr) =>
                  setFormData({
                    ...formData,
                    home: { ...formData.home, purifierCadrM3h: cadr },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 pt-1 text-xs">
        <label htmlFor="room-volume-input" className="text-ink-muted">
          {t("ui.household.roomVolume", undefined, language)}
        </label>
        <input
          id="room-volume-input"
          type="number"
          min="10"
          max="500"
          aria-describedby="room-volume-help"
          value={formData.home.roomVolumeM3 ?? 45}
          onChange={(e) =>
            setFormData({
              ...formData,
              home: { ...formData.home, roomVolumeM3: Number(e.target.value) },
            })
          }
          className="px-3 py-1.5 rounded-control border border-line bg-surface text-ink text-xs max-w-xs focus:border-action"
        />
        <span id="room-volume-help" className="text-[11px] text-ink-muted">
          {t("ui.household.roomVolumeHelp", undefined, language)}
        </span>
      </div>
    </fieldset>
  );
};
