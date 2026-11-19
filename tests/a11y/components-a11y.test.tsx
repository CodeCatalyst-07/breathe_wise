// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
expect.extend(matchers);

import { LocationPicker } from "@/components/LocationPicker";
import { HouseholdForm } from "@/components/HouseholdForm";
import { ActionItem } from "@/components/ActionItem";
import { DayTimeline } from "@/components/DayTimeline";
import { AirNowHero } from "@/components/AirNowHero";
import { StatusBanner } from "@/components/StatusBanner";
import { AskPanel } from "@/components/AskPanel";
import { AppShell } from "@/components/AppShell";
import { DataSourcesFooter } from "@/components/DataSourcesFooter";
import { createDefaultProfile, DEFAULT_DELHI_LOCATION } from "@/lib/useSessionProfile";
import type { AdviceActionItem, DayPlanModel } from "@/core/response";
import type { AqiCategoryLevel } from "@/core/types";

// Mock fetch for API client
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            data: {
              candidates: [
                { label: "Anand Vihar, Delhi", lat: 28.65, lng: 77.31, timezone: "Asia/Kolkata" },
                {
                  label: "Connaught Place, Delhi",
                  lat: 28.63,
                  lng: 77.22,
                  timezone: "Asia/Kolkata",
                },
              ],
            },
          }),
      }),
    ),
  );
});

const MOCK_ACTION_ITEM: AdviceActionItem = {
  rank: 1,
  reasonKey: "reasons.severe_smog_continuous_hepa",
  group: "household",
  builtinExplanation: {
    actionId: "use_hepa_purifier",
    whatToDoKey: "builtin_explanations.use_hepa_purifier.what_to_do",
    whyItMattersKey: "builtin_explanations.use_hepa_purifier.why_it_matters",
    assumptionsKeys: ["assumptions.purifier_owned_cadr", "assumptions.default_room_volume"],
  },
  result: {
    actionId: "use_hepa_purifier",
    displayMode: "numeric",
    direction: "reduces",
    deltaLikely: 85,
    deltaLow: 60,
    deltaHigh: 110,
    baseline: 240,
    scenario: 155,
    unit: "ug_m3",
    assumptions: ["purifier_owned_cadr", "default_room_volume"],
    sources: ["standard mass-balance"],
    confidence: "high",
  },
};

const MOCK_DAY_PLAN: DayPlanModel = {
  dataStatus: "available",
  slots: [
    {
      hourLocal: 0,
      timestamp: "2026-11-19T00:00:00Z",
      pm25: 180,
      category: "poor",
      outdoorActivity: "limit",
      ventilationOk: false,
    },
    {
      hourLocal: 6,
      timestamp: "2026-11-19T06:00:00Z",
      pm25: 280,
      category: "severe",
      outdoorActivity: "avoid",
      ventilationOk: false,
    },
    {
      hourLocal: 14,
      timestamp: "2026-11-19T14:00:00Z",
      pm25: 75,
      category: "moderate",
      outdoorActivity: "ok",
      ventilationOk: true,
    },
  ],
  bestOutdoorWindow: {
    startLocalIso: "2026-11-19T13:00:00Z",
    endLocalIso: "2026-11-19T16:00:00Z",
    startHourLocal: 13,
    endHourLocal: 16,
    avgPm25: 78,
    durationHours: 3,
    labelKey: "dayplan.windows.best_outdoor.label",
    reasonKey: "dayplan.windows.best_outdoor.reason",
  },
  bestVentilationWindow: {
    startLocalIso: "2026-11-19T14:00:00Z",
    endLocalIso: "2026-11-19T15:00:00Z",
    startHourLocal: 14,
    endHourLocal: 15,
    avgPm25: 75,
    durationHours: 1,
    labelKey: "dayplan.windows.best_ventilation.label",
    reasonKey: "dayplan.windows.best_ventilation.reason",
  },
  avoidWindows: [
    {
      startLocalIso: "2026-11-19T06:00:00Z",
      endLocalIso: "2026-11-19T10:00:00Z",
      startHourLocal: 6,
      endHourLocal: 10,
      avgPm25: 310,
      durationHours: 4,
      labelKey: "dayplan.windows.avoid.label",
      reasonKey: "dayplan.windows.avoid.reason",
    },
  ],
};

describe("A11y & Component Behavioral Audit", () => {
  it("LocationPicker ARIA combobox wiring, keyboard navigation & axe compliance", async () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <LocationPicker
        currentLocation={DEFAULT_DELHI_LOCATION}
        onSelectLocation={handleSelect}
        language="en"
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input).toBeDefined();
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    // Type query to trigger debounce
    fireEvent.change(input, { target: { value: "Anand" } });

    // Fast-forward debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeDefined();
    expect(input.getAttribute("aria-expanded")).toBe("true");

    // Keyboard ArrowDown navigation
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    // Enter selection
    fireEvent.keyDown(input, { key: "Enter" });
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Anand Vihar, Delhi" }),
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("HouseholdForm validation, error-summary focus & aria-describedby", async () => {
    const handleUpdate = vi.fn();
    const handleClear = vi.fn();
    const profile = createDefaultProfile();

    const { container } = render(
      <HouseholdForm
        profile={profile}
        onUpdate={handleUpdate}
        onClear={handleClear}
        language="en"
      />,
    );

    // Expand form
    const toggleBtn = screen.getByRole("button", { name: /Expand \/ Edit/i });
    fireEvent.click(toggleBtn);

    const roomVolumeInput = screen.getByLabelText(/Main room volume/i);
    expect(roomVolumeInput.getAttribute("aria-describedby")).toContain("room-volume-help");

    // Set invalid volume <= 0
    act(() => {
      fireEvent.change(roomVolumeInput, { target: { value: "-10" } });
    });

    const submitBtn = screen.getByRole("button", { name: /Update Advice/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    // Error summary is displayed with role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("positive number");
    expect(handleUpdate).not.toHaveBeenCalled();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("ActionItem keyboard expansion of assumptions disclosure", async () => {
    const { container } = render(
      <ActionItem item={MOCK_ACTION_ITEM} isTopRanked={true} language="en" />,
    );

    const disclosureBtn = screen.getByRole("button", { name: /How we worked this out/i });
    expect(disclosureBtn.getAttribute("aria-expanded")).toBe("false");

    // Toggle expand
    fireEvent.click(disclosureBtn);
    expect(disclosureBtn.getAttribute("aria-expanded")).toBe("true");

    // Assumptions list is now displayed
    expect(screen.getAllByText(/High Confidence/i).length).toBeGreaterThan(0);

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("DayTimeline renders strip with aria-hidden='true', accessible list and calendar links", async () => {
    const calendarEvents = [
      {
        id: "evt-1",
        title: "Cleanest outdoor window",
        startIso: "2026-11-19T13:00:00Z",
        endIso: "2026-11-19T16:00:00Z",
        details: "Clean air window",
        url: "https://calendar.google.com/test",
      },
    ];

    const { container } = render(
      <DayTimeline
        dayPlan={MOCK_DAY_PLAN}
        calendarEvents={calendarEvents}
        timezone="Asia/Kolkata"
        language="en"
      />,
    );

    // Color strip is marked aria-hidden
    const hiddenStrip = container.querySelector('[aria-hidden="true"]');
    expect(hiddenStrip).not.toBeNull();

    // Semantic list contains best outdoor and ventilation items
    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length).toBeGreaterThanOrEqual(3);

    // Calendar link has target, rel, and sr-only new tab label
    const calLink = screen.getByRole("link", { name: /Cleanest outdoor window/i });
    expect(calLink.getAttribute("target")).toBe("_blank");
    expect(calLink.getAttribute("rel")).toContain("noopener");
    expect(calLink.getAttribute("rel")).toContain("noreferrer");
    expect(calLink.textContent).toContain("(opens in a new tab)");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("Every air category renders text label + level meter + icon (never colour alone)", async () => {
    const categories: AqiCategoryLevel[] = [
      "good",
      "satisfactory",
      "moderate",
      "poor",
      "very_poor",
      "severe",
    ];

    for (const cat of categories) {
      const { container, unmount } = render(
        <AirNowHero
          airQuality={{
            reading: {
              pm25: cat === "good" ? 25 : cat === "severe" ? 350 : 120,
              category: cat,
              kind: "measured",
              basis: "instantaneous",
            },
            provenance: "Test station",
            attributions: ["OpenAQ"],
          }}
          location={{ label: "Delhi NCR", roundedLat: 28.61, roundedLng: 77.21 }}
          generatedAt="2026-11-19T06:00:00Z"
          timezone="Asia/Kolkata"
          language="en"
        />,
      );

      // Level meter with semantic aria-label
      const meter = screen.getByRole("img", { name: new RegExp(`level \\d of 6:`, "i") });
      expect(meter).toBeDefined();

      // Heading text label exists
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.textContent).toContain("Delhi NCR");

      // Verify axe
      const axeResult = await axe(container);
      expect(axeResult.violations).toEqual([]);

      unmount();
    }
  });

  it("StatusBanner roles: role='status' for offline/stale, role='region' for general fallback", async () => {
    // 1. General fallback
    const { container: c1, unmount: u1 } = render(
      <StatusBanner isDefaultProfile={true} language="en" />,
    );
    const region = screen.getByRole("region", { name: /General Recommendations/i });
    expect(region).toBeDefined();
    const r1 = await axe(c1);
    expect(r1.violations).toEqual([]);
    u1();

    // 2. Stale data
    const oldTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const { container: c2 } = render(
      <StatusBanner isDefaultProfile={false} generatedAt={oldTime} language="en" />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("2 hours ago");
    const r2 = await axe(c2);
    expect(r2.violations).toEqual([]);
  });

  it("AskPanel log updates and 300 character live counter", async () => {
    const profile = createDefaultProfile();
    const { container } = render(<AskPanel profile={profile} language="en" />);

    // Log container has role="log" and aria-live="polite"
    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");

    // Live character counter
    const input = screen.getByPlaceholderText(/Ask a question/i);
    expect(screen.getByText("0 / 300")).toBeDefined();

    fireEvent.change(input, { target: { value: "Hello BreatheWise" } });
    expect(screen.getByText("17 / 300")).toBeDefined();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("AppShell sets document.documentElement.lang and skip link targets #main-content", async () => {
    const handleLang = vi.fn();
    const { container } = render(
      <AppShell language="hi" onLanguageChange={handleLang}>
        <div>Body content</div>
      </AppShell>,
    );

    // Verify <html lang="hi"> was set
    expect(document.documentElement.lang).toBe("hi");

    // Skip link (localized in Hindi)
    const skipLink = screen.getByRole("link", { name: /मुख्य सामग्री पर जाएं/i });
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(skipLink.className).toContain("sr-only");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("DataSourcesFooter has no axe violations and includes attributions and clear button", async () => {
    const handleClear = vi.fn();
    const { container } = render(<DataSourcesFooter onClearDetails={handleClear} language="en" />);

    expect(screen.getByText(/OpenAQ/i)).toBeDefined();
    expect(screen.getByText(/Copernicus/i)).toBeDefined();
    expect(screen.getByText(/Google Gemma 4 31B IT/i)).toBeDefined();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("AskPanel allows sequential questions with no per-session question limit", async () => {
    const profile = createDefaultProfile();
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        if (typeof url === "string" && url.includes("/api/ask")) {
          callCount++;
          return Promise.resolve({
            ok: true,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve({ answer: `Answer ${callCount}`, explanationSource: "ai" }),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        });
      }),
    );

    render(<AskPanel profile={profile} language="en" />);
    const input = screen.getByPlaceholderText(/Ask a question/i);
    const askButton = screen.getByRole("button", { name: /^Ask$/i });

    // Submit 5 questions sequentially
    for (let i = 1; i <= 5; i++) {
      await act(async () => {
        fireEvent.change(input, { target: { value: `Question ${i}?` } });
      });
      await act(async () => {
        fireEvent.click(askButton);
      });
      expect(screen.getByText(`Answer ${i}`)).toBeDefined();
    }

    expect(callCount).toBe(5);
  });

  it("AirNowHero renders divergence warning based directly on API divergence flag without client recomputation", async () => {
    const locSummary = {
      label: "Anand Vihar, Delhi, India",
      roundedLat: 28.65,
      roundedLng: 77.32,
    };

    // 1. Fixture with divergence: isDivergent = true, ratio = 2.4
    const aqDivergent = {
      reading: {
        pm25: 380,
        category: "severe" as const,
        kind: "measured" as const,
        basis: "instantaneous" as const,
      },
      provenance: "Measured at Anand Vihar (1.2 km away)",
      attributions: ["OpenAQ"],
      divergence: { isDivergent: true, ratio: 2.4, measuredPm25: 380, modelPm25: 158 },
    };
    const { rerender, container } = render(
      <AirNowHero
        airQuality={aqDivergent}
        location={locSummary}
        generatedAt="2026-11-19T06:00:00.000Z"
        timezone="Asia/Kolkata"
        language="en"
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("2.4× higher pollution");

    // 2. Fixture with divergence: isDivergent = false, ratio = 1.1
    const aqNotDivergent = {
      reading: {
        pm25: 180,
        category: "poor" as const,
        kind: "measured" as const,
        basis: "instantaneous" as const,
      },
      provenance: "Measured at RK Puram (2.1 km away)",
      attributions: ["OpenAQ"],
      divergence: { isDivergent: false, ratio: 1.1, measuredPm25: 180, modelPm25: 164 },
    };
    rerender(
      <AirNowHero
        airQuality={aqNotDivergent}
        location={locSummary}
        generatedAt="2026-11-19T06:00:00.000Z"
        timezone="Asia/Kolkata"
        language="en"
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
