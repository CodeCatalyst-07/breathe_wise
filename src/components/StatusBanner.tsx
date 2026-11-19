"use client";

import React, { useState, useEffect } from "react";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";

interface StatusBannerProps {
  isDefaultProfile?: boolean;
  generatedAt?: string;
  language?: Language;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  isDefaultProfile = false,
  generatedAt,
  language = "en",
}) => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  const isStale = Boolean(
    generatedAt && Date.now() - new Date(generatedAt).getTime() > 2 * 60 * 60 * 1000,
  );

  if (isOffline) {
    return (
      <div
        role="status"
        className="w-full bg-tint-very-poor border-b border-mark-very-poor/40 text-mark-very-poor text-xs font-semibold py-2 px-4 text-center"
      >
        📡 {t("ui.status.offline", undefined, language)}
      </div>
    );
  }

  if (isStale) {
    return (
      <div
        role="status"
        className="w-full bg-tint-moderate border-b border-mark-moderate/40 text-ink text-xs font-semibold py-2 px-4 text-center"
      >
        ⏳ {t("ui.status.stale", undefined, language)}
      </div>
    );
  }

  if (isDefaultProfile) {
    return (
      <div
        role="region"
        aria-label="General Recommendations"
        className="w-full bg-tint-good/60 border border-mark-good/30 rounded-control text-ink text-xs p-3 flex items-center justify-between gap-2 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">ℹ️</span>
          <span>{t("ui.status.generalFallback", undefined, language)}</span>
        </div>
      </div>
    );
  }

  return null;
};
