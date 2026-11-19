import { describe, expect, it } from "vitest";
import { buildCalendarTemplateUrl, planCalendarEvents } from "@/core/calendar";
import type { DayPlan } from "@/core/dayplan";
import { CALENDAR_DETAILS_MAX_LENGTH, CALENDAR_TITLE_MAX_LENGTH } from "@/core/heuristics";

describe("Google Calendar Integration", () => {
  it("builds valid Google Calendar template URL with encoded parameters and timezone", () => {
    const url = buildCalendarTemplateUrl({
      title: "Clean Air Window",
      startLocalIso: "2026-11-19T06:00:00Z",
      endLocalIso: "2026-11-19T08:00:00Z",
      timezone: "Asia/Kolkata",
      details: "Safest time for ventilation.",
    });

    expect(url).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(url).toContain("text=Clean+Air+Window");
    expect(url).toContain("ctz=Asia%2FKolkata");
    expect(url).toContain("dates=");
    expect(url).toContain("details=Safest+time+for+ventilation.");
  });

  it("handles Hindi unicode text and special characters correctly", () => {
    const hindiTitle = "घर हवादार करने का समय";
    const hindiDetails = "वायु गुणवत्ता बेहतर है & खिड़कियां खोलें!";
    const url = buildCalendarTemplateUrl({
      title: hindiTitle,
      startLocalIso: "2026-11-19T06:00:00Z",
      endLocalIso: "2026-11-19T07:00:00Z",
      timezone: "Asia/Kolkata",
      details: hindiDetails,
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("text")).toBe(hindiTitle);
    expect(parsed.searchParams.get("details")).toBe(hindiDetails);
  });

  it("enforces length caps and strips unprintable control characters", () => {
    const longTitle = "A".repeat(150) + "\u0000\u001F";
    const longDetails = "B".repeat(600) + "\u0007\u0008";

    const url = buildCalendarTemplateUrl({
      title: longTitle,
      startLocalIso: "2026-11-19T06:00:00Z",
      endLocalIso: "2026-11-19T07:00:00Z",
      timezone: "UTC",
      details: longDetails,
    });

    const parsed = new URL(url);
    const title = parsed.searchParams.get("text")!;
    const details = parsed.searchParams.get("details")!;

    expect(title.length).toBeLessThanOrEqual(CALENDAR_TITLE_MAX_LENGTH);
    expect(details.length).toBeLessThanOrEqual(CALENDAR_DETAILS_MAX_LENGTH);
    expect(title).not.toMatch(/[\u0000-\u001F]/);
    expect(details).not.toMatch(/[\u0000-\u001F]/);
  });

  it("strictly enforces privacy invariants: no coordinates, health flags, or PII", () => {
    const dummyDayPlan: DayPlan = {
      dataStatus: "available",
      slots: [],
      bestOutdoorWindow: {
        startLocalIso: "2026-11-19T06:00:00Z",
        endLocalIso: "2026-11-19T07:00:00Z",
        startHourLocal: 6,
        endHourLocal: 7,
        avgPm25: 45,
        durationHours: 1,
        labelKey: "best_outdoor",
        reasonKey: "cleanest",
      },
      bestVentilationWindow: {
        startLocalIso: "2026-11-19T07:00:00Z",
        endLocalIso: "2026-11-19T08:00:00Z",
        startHourLocal: 7,
        endHourLocal: 8,
        avgPm25: 50,
        durationHours: 1,
        labelKey: "best_vent",
        reasonKey: "ventilate",
      },
      avoidWindows: [
        {
          startLocalIso: "2026-11-19T18:00:00Z",
          endLocalIso: "2026-11-19T22:00:00Z",
          startHourLocal: 18,
          endHourLocal: 22,
          avgPm25: 250,
          durationHours: 4,
          labelKey: "avoid",
          reasonKey: "severe",
        },
      ],
    };

    const events = planCalendarEvents(dummyDayPlan, "Asia/Kolkata");
    expect(events.length).toBeLessThanOrEqual(3);

    for (const ev of events) {
      // Must never contain sensitive words or patterns
      const combined = `${ev.title} ${ev.details} ${ev.url}`.toLowerCase();
      expect(combined).not.toContain("asthma");
      expect(combined).not.toContain("elderly");
      expect(combined).not.toContain("child");
      expect(combined).not.toContain("latitude");
      expect(combined).not.toContain("longitude");
      expect(combined).not.toContain("28.6139");
      expect(combined).not.toContain("77.209");
    }
  });

  it("localizes calendar event titles and details when language is Hindi", () => {
    const dummyDayPlan: DayPlan = {
      dataStatus: "available",
      bestOutdoorWindow: {
        startLocalIso: "2026-11-19T14:00:00.000Z",
        endLocalIso: "2026-11-19T16:00:00.000Z",
        startHourLocal: 14,
        endHourLocal: 16,
        durationHours: 2,
        avgPm25: 65,
        labelKey: "dayplan.windows.best_outdoor.label",
        reasonKey: "dayplan.windows.best_outdoor.reason",
      },
      bestVentilationWindow: {
        startLocalIso: "2026-11-19T15:00:00.000Z",
        endLocalIso: "2026-11-19T16:00:00.000Z",
        startHourLocal: 15,
        endHourLocal: 16,
        durationHours: 1,
        avgPm25: 60,
        labelKey: "dayplan.windows.best_ventilation.label",
        reasonKey: "dayplan.windows.best_ventilation.reason",
      },
      avoidWindows: [
        {
          startLocalIso: "2026-11-19T08:00:00.000Z",
          endLocalIso: "2026-11-19T11:00:00.000Z",
          startHourLocal: 8,
          endHourLocal: 11,
          durationHours: 3,
          avgPm25: 220,
          labelKey: "dayplan.windows.avoid.label",
          reasonKey: "dayplan.windows.avoid.reason",
        },
      ],
      slots: [],
    };

    const eventsHi = planCalendarEvents(dummyDayPlan, "Asia/Kolkata", "hi");
    expect(eventsHi.length).toBe(3);
    expect(eventsHi[0]!.title).toContain("बाहरी कार्यों");
    expect(eventsHi[0]!.details).toContain("ब्रीदवाइज");
    expect(eventsHi[1]!.title).toContain("कमरे में हवा");
    expect(eventsHi[2]!.title).toContain("स्मॉग बढ़ने");
  });

  it("returns empty list if forecast is unavailable", () => {
    const emptyPlan: DayPlan = {
      dataStatus: "forecast_unavailable",
      slots: [],
      avoidWindows: [],
    };
    expect(planCalendarEvents(emptyPlan)).toHaveLength(0);
  });
});
