"use client";

import React, { useState, useRef } from "react";
import type { HouseholdProfile, Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { DescribeHousehold } from "./DescribeHousehold";
import { WhoLivesHereFieldset, CommuteFieldset } from "./HouseholdFields";
import { YourHomeFieldset } from "./HouseholdYourHome";

interface HouseholdFormProps {
  profile: HouseholdProfile;
  onUpdate: (updated: HouseholdProfile) => void;
  onClear: () => void;
  language?: Language;
}

export const HouseholdForm: React.FC<HouseholdFormProps> = ({
  profile,
  onUpdate,
  onClear,
  language = "en",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<HouseholdProfile>(profile);
  const [hasPurifier, setHasPurifier] = useState<boolean>(
    Boolean(profile.home.purifierCadrM3h && profile.home.purifierCadrM3h > 0),
  );
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.home.roomVolumeM3 !== undefined && formData.home.roomVolumeM3 <= 0) {
      setErrorSummary("Room volume must be a positive number.");
      errorRef.current?.focus();
      return;
    }
    setErrorSummary(null);
    onUpdate({
      ...formData,
      home: {
        ...formData.home,
        purifierCadrM3h: hasPurifier ? formData.home.purifierCadrM3h || 250 : 0,
      },
    });
  };

  return (
    <section
      aria-labelledby="household-form-heading"
      className="w-full bg-surface rounded-panel border border-line p-5 sm:p-6 shadow-sm flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 id="household-form-heading" className="text-lg font-serif font-bold text-ink">
            ⚙️ {t("ui.household.title", undefined, language)}
          </h2>
          <p className="text-xs text-ink-muted">
            {t("ui.household.subtitle", undefined, language)}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold text-action hover:underline focus-visible:ring-2 rounded px-2 py-1"
        >
          {isOpen ? "▲ Collapse" : "▼ Expand / Edit"}
        </button>
      </header>

      {isOpen && (
        <div className="flex flex-col gap-6 pt-2 border-t border-line/60">
          <DescribeHousehold
            onParsed={(draft) => {
              setFormData(draft);
              setHasPurifier(Boolean(draft.home.purifierCadrM3h && draft.home.purifierCadrM3h > 0));
            }}
            language={language}
          />

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            {errorSummary && (
              <div
                id="form-error-summary"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="p-3 bg-tint-very-poor border border-mark-very-poor rounded-control text-xs text-mark-very-poor font-semibold focus:outline-none"
              >
                {errorSummary}
              </div>
            )}

            <WhoLivesHereFieldset
              formData={formData}
              setFormData={setFormData}
              language={language}
            />

            <CommuteFieldset formData={formData} setFormData={setFormData} language={language} />

            <YourHomeFieldset
              formData={formData}
              setFormData={setFormData}
              hasPurifier={hasPurifier}
              setHasPurifier={setHasPurifier}
              language={language}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60">
              <button
                type="submit"
                className="px-4 py-2 rounded-control text-xs font-semibold bg-action text-white hover:bg-action-hover transition-colors"
              >
                {t("ui.household.updateButton", undefined, language)}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("ui.household.clearConfirm", undefined, language))) {
                    onClear();
                    setIsOpen(false);
                  }
                }}
                className="text-xs text-mark-very-poor hover:underline font-medium"
              >
                {t("ui.household.clearButton", undefined, language)}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
