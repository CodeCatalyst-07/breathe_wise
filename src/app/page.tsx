"use client";

import React, { useState } from "react";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { useSessionProfile } from "@/lib/useSessionProfile";
import { useAdvice } from "@/lib/useAdvice";
import { AppShell } from "@/components/AppShell";
import { StatusBanner } from "@/components/StatusBanner";
import { LocationPicker } from "@/components/LocationPicker";
import { AirNowHero } from "@/components/AirNowHero";
import dynamic from "next/dynamic";
import { AdviceSkeleton } from "@/components/Skeletons";

const ActionList = dynamic(() => import("@/components/ActionList").then((mod) => mod.ActionList), {
  loading: () => <div className="h-44 rounded-panel bg-line/20 animate-pulse" />,
});

const OutlookLine = dynamic(
  () => import("@/components/OutlookLine").then((mod) => mod.OutlookLine),
  {
    loading: () => <div className="h-44 rounded-panel bg-line/20 animate-pulse" />,
  },
);

const DayTimeline = dynamic(
  () => import("@/components/DayTimeline").then((mod) => mod.DayTimeline),
  {
    loading: () => <div className="h-44 rounded-panel bg-line/20 animate-pulse" />,
  },
);

const DataSourcesFooter = dynamic(
  () => import("@/components/DataSourcesFooter").then((mod) => mod.DataSourcesFooter),
  { ssr: true },
);

const HouseholdForm = dynamic(
  () => import("@/components/HouseholdForm").then((mod) => mod.HouseholdForm),
  {
    loading: () => <div className="h-40 rounded-panel bg-line/20 animate-pulse" />,
    ssr: false,
  },
);

const AskPanel = dynamic(() => import("@/components/AskPanel").then((mod) => mod.AskPanel), {
  loading: () => <div className="h-40 rounded-panel bg-line/20 animate-pulse" />,
});

const SharePlanBar = dynamic(
  () => import("@/components/SharePlanBar").then((mod) => mod.SharePlanBar),
  {
    ssr: false,
  },
);

const CommunityActions = dynamic(
  () => import("@/components/CommunityActions").then((mod) => mod.CommunityActions),
  {
    loading: () => <div className="h-28 rounded-panel bg-line/20 animate-pulse" />,
  },
);

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("en");
  const { profile, updateProfile, updateLocation, clearProfile } = useSessionProfile(language);
  const { advice, loading, error, refetch } = useAdvice(profile);

  const isDefaultProfile =
    profile.household.childrenAgeBands.length === 0 &&
    !profile.household.hasElderly &&
    !profile.household.hasRespiratoryCondition &&
    profile.home.purifierCadrM3h === 0;

  return (
    <AppShell language={language} onLanguageChange={setLanguage} onClearDetails={clearProfile}>
      <StatusBanner
        isDefaultProfile={isDefaultProfile}
        generatedAt={advice?.generatedAt}
        language={language}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main 2/3 Column: Hero, Day Routine, Ranked Actions */}
          <div className="lg:col-span-8 flex flex-col gap-8 w-full">
            {loading && !advice && <AdviceSkeleton />}

            {error && !advice && (
              <div
                role="alert"
                className="p-6 bg-surface border border-mark-very-poor rounded-panel shadow-sm flex flex-col items-center gap-3 text-center"
              >
                <span className="text-3xl" aria-hidden="true">
                  ⚠️
                </span>
                <p className="font-semibold text-mark-very-poor">{error}</p>
                <p className="text-xs text-ink-muted max-w-md">
                  {t("safety.disclaimer.general_guidance", undefined, language)}{" "}
                  {t("safety.medical.seek_help_for_symptoms", undefined, language)}
                </p>
                <button
                  type="button"
                  onClick={refetch}
                  className="px-4 py-2 rounded-control text-xs font-semibold bg-action text-white hover:bg-action-hover transition-colors"
                >
                  Retry Loading
                </button>
              </div>
            )}

            {advice && (
              <>
                {/* Anchor: #today */}
                <div id="today" className="flex flex-col gap-6">
                  <AirNowHero
                    airQuality={advice.airQuality}
                    location={advice.location}
                    generatedAt={advice.generatedAt}
                    timezone={advice.timezone}
                    language={language}
                  />

                  <OutlookLine
                    outlook={advice.outlook}
                    dayPlan={advice.dayPlan}
                    language={language}
                  />

                  <DayTimeline
                    dayPlan={advice.dayPlan}
                    calendarEvents={advice.calendarEvents}
                    timezone={advice.timezone}
                    language={language}
                  />

                  <SharePlanBar advice={advice} language={language} />
                </div>

                {/* Anchor: #what-helps */}
                <div id="what-helps" className="flex flex-col gap-8 pt-4 border-t border-line/60">
                  <ActionList
                    actions={advice.actions}
                    explanation={advice.explanation}
                    language={language}
                  />

                  <CommunityActions
                    actions={advice.actions}
                    explanation={advice.explanation}
                    language={language}
                  />
                </div>

                {/* Mobile-only Ask Section */}
                <div id="ask" className="lg:hidden pt-4 border-t border-line/60">
                  <AskPanel profile={profile} language={language} />
                </div>
              </>
            )}
          </div>

          {/* Sidebar 1/3 Column: Location, Household Form, Desktop Ask Assistant */}
          <aside
            aria-label="Household and Location Controls"
            className="lg:col-span-4 flex flex-col gap-6 w-full lg:sticky lg:top-20"
          >
            <div className="bg-surface rounded-panel border border-line p-5 sm:p-6 shadow-sm">
              <LocationPicker
                currentLocation={profile.location}
                onSelectLocation={updateLocation}
                language={language}
              />
            </div>

            <HouseholdForm
              profile={profile}
              onUpdate={updateProfile}
              onClear={clearProfile}
              language={language}
            />

            {/* Desktop Ask Panel */}
            <div className="hidden lg:block">
              <AskPanel profile={profile} language={language} />
            </div>
          </aside>
        </div>
      </div>

      <DataSourcesFooter onClearDetails={clearProfile} language={language} />
    </AppShell>
  );
}
