"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";

interface AppShellProps {
  children: React.ReactNode;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onClearDetails?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, language, onLanguageChange }) => {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const toggleLanguage = () => {
    onLanguageChange(language === "en" ? "hi" : "en");
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-action text-white font-semibold rounded-control shadow-md"
      >
        {t("ui.nav.skipToContent", undefined, language)}
      </a>

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-line shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 focus-visible:ring-2 rounded p-1 shrink-0"
          >
            <span className="text-2xl" role="img" aria-label="BreatheWise logo">
              🍃
            </span>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-base sm:text-xl tracking-tight text-ink leading-tight">
                BreatheWise
              </span>
              <span className="text-[11px] text-ink-muted hidden sm:inline">
                {t("app.tagline", undefined, language)}
              </span>
            </div>
          </Link>

          <nav aria-label="Main Navigation" className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link
              href="/about"
              className="text-xs sm:text-sm font-medium text-ink-muted hover:text-ink focus-visible:ring-2 rounded px-1.5 py-1 whitespace-nowrap"
            >
              {t("ui.nav.about", undefined, language)}
            </Link>

            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-control text-xs font-semibold border border-line bg-surface hover:bg-paper focus-visible:ring-2 text-action whitespace-nowrap"
            >
              {language === "en" ? "हिन्दी" : "English"}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Landmark */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {/* Mobile Floating Bottom Anchor Bar (<lg) */}
      <nav
        aria-label="Mobile Sections"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-line shadow-lg"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 h-14">
          <a
            href="#today"
            className="flex flex-col items-center justify-center text-xs font-semibold text-ink-muted hover:text-action active:text-action focus-visible:ring-2"
          >
            <span aria-hidden="true" className="text-base">
              ☀️
            </span>
            <span>{t("ui.nav.today", undefined, language)}</span>
          </a>
          <a
            href="#what-helps"
            className="flex flex-col items-center justify-center text-xs font-semibold text-ink-muted hover:text-action active:text-action focus-visible:ring-2"
          >
            <span aria-hidden="true" className="text-base">
              🛡️
            </span>
            <span>{t("ui.nav.whatHelps", undefined, language)}</span>
          </a>
          <a
            href="#ask"
            className="flex flex-col items-center justify-center text-xs font-semibold text-ink-muted hover:text-action active:text-action focus-visible:ring-2"
          >
            <span aria-hidden="true" className="text-base">
              💡
            </span>
            <span>{t("ui.nav.ask", undefined, language)}</span>
          </a>
        </div>
      </nav>
    </div>
  );
};
