"use client";

import React from "react";
import type { CalendarEventModel } from "@/core/response";
import type { Language } from "@/core/types";
import { t } from "@/lib/i18n";

interface CalendarLinksProps {
  events: CalendarEventModel[];
  language?: Language;
}

export const CalendarLinks: React.FC<CalendarLinksProps> = ({ events, language = "en" }) => {
  if (!events || events.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {events.map((evt) => (
        <a
          key={evt.id}
          href={evt.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold bg-action/10 text-action hover:bg-action hover:text-white transition-colors duration-150 border border-action/30"
        >
          <span>📅</span>
          <span>{evt.title}</span>
          <span className="sr-only"> {t("ui.dayplan.opensNewTab", undefined, language)}</span>
        </a>
      ))}
    </div>
  );
};
