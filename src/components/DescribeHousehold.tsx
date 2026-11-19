"use client";

import React, { useState } from "react";
import type { HouseholdProfile, Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { fetchParseProfile } from "@/lib/api-client";

interface DescribeHouseholdProps {
  onParsed: (draft: HouseholdProfile) => void;
  language?: Language;
}

export const DescribeHousehold: React.FC<DescribeHouseholdProps> = ({
  onParsed,
  language = "en",
}) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetchParseProfile(text.trim(), language);
      onParsed(res.draftProfile);
      setSuccessMsg(t("ui.household.parseSuccess", undefined, language));
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to parse description. Please fill in details manually.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleParse} className="flex flex-col gap-2.5 pt-2">
      <label
        htmlFor="describe-household-text"
        className="text-xs font-semibold text-ink flex items-center justify-between"
      >
        <span>💬 {t("ui.household.naturalLanguageHeading", undefined, language)}</span>
      </label>

      <textarea
        id="describe-household-text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("ui.household.naturalLanguagePlaceholder", undefined, language)}
        className="w-full px-3 py-2 text-xs sm:text-sm rounded-control border border-line bg-surface text-ink resize-y focus:border-action focus-visible:outline-none"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-3.5 py-1.5 rounded-control text-xs font-semibold bg-action text-white hover:bg-action-hover disabled:opacity-50 transition-colors"
        >
          {loading
            ? t("ui.household.parsing", undefined, language)
            : t("ui.household.parseButton", undefined, language)}
        </button>
      </div>

      {successMsg && (
        <p role="status" className="text-xs text-mark-good font-medium">
          ✓ {successMsg}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-mark-very-poor font-medium">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
};
