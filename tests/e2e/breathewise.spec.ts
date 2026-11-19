import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const mockAdviceData = {
  requestId: "e2e-test-request",
  generatedAt: "2026-11-19T06:30:00.000Z",
  timezone: "Asia/Kolkata",
  location: {
    label: "Anand Vihar, Delhi, India",
    roundedLat: 28.65,
    roundedLng: 77.32,
  },
  dataStatus: "available",
  airQuality: {
    provenance: "openaq",
    attributions: ["OpenAQ", "Copernicus Atmosphere Monitoring Service"],
    reading: {
      pm25: 345,
      category: "severe",
      kind: "measured",
      basis: "instantaneous",
      ordinal: 6,
    },
    divergence: {
      isDivergent: true,
      ratio: 2.1,
      measuredPm25: 345,
      modelPm25: 164,
    },
  },
  outlook: {
    status: "worsening",
    thresholdUsed: 20,
    cleanestHour: {
      hourLocal: 14,
      timestamp: "2026-11-19T14:00:00.000Z",
      pm25: 195,
    },
    worstHour: {
      hourLocal: 8,
      timestamp: "2026-11-19T08:00:00.000Z",
      pm25: 410,
    },
  },
  dayPlan: {
    dataStatus: "available",
    slots: Array.from({ length: 24 }).map((_, i) => ({
      hourLocal: i,
      timestamp: `2026-11-19T${String(i).padStart(2, "0")}:00:00.000Z`,
      pm25: i === 14 ? 195 : 320,
      category: i === 14 ? "very_poor" : "severe",
      outdoorActivity: i === 14 ? "limit" : "avoid",
      ventilationOk: i === 14,
    })),
    bestOutdoorWindow: {
      startLocalIso: "2026-11-19T14:00:00.000Z",
      endLocalIso: "2026-11-19T16:00:00.000Z",
      startHourLocal: 14,
      endHourLocal: 16,
      avgPm25: 198,
      durationHours: 2,
      labelKey: "dayplan.windows.best_outdoor.label",
      reasonKey: "dayplan.windows.best_outdoor.reason",
    },
    avoidWindows: [
      {
        startLocalIso: "2026-11-19T07:00:00.000Z",
        endLocalIso: "2026-11-19T11:00:00.000Z",
        startHourLocal: 7,
        endHourLocal: 11,
        avgPm25: 390,
        durationHours: 4,
        labelKey: "dayplan.windows.avoid.label",
        reasonKey: "dayplan.windows.avoid.reason",
      },
    ],
  },
  calendarEvents: [
    {
      id: "best_outdoor_window",
      title: "Cleanest outdoor window",
      startIso: "2026-11-19T14:00:00.000Z",
      endIso: "2026-11-19T16:00:00.000Z",
      details: "BreatheWise routine advisory: Forecast pollution is lowest during this window.",
      url: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Cleanest+window",
    },
  ],
  actions: [
    {
      rank: 1,
      reasonKey: "reasons.severe_smog_continuous_hepa",
      group: "household",
      result: {
        actionId: "use_hepa_purifier",
        displayMode: "numeric",
        baseline: 280,
        scenario: 120,
        deltaLikely: 160,
        deltaLow: 110,
        deltaHigh: 210,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "high",
        assumptions: ["assumptions.purifier_owned_cadr", "assumptions.air_exchange_closed"],
        sources: ["AHAM AC-1 / Standard Sizing"],
      },
      builtinExplanation: {
        actionId: "use_hepa_purifier",
        whatToDoKey: "builtin_explanations.use_hepa_purifier.what_to_do",
        whyItMattersKey: "builtin_explanations.use_hepa_purifier.why_it_matters",
        assumptionsKeys: ["assumptions.purifier_owned_cadr"],
      },
    },
    {
      rank: 2,
      reasonKey: "reasons.severe_smog_seal_envelope",
      group: "household",
      result: {
        actionId: "keep_windows_closed_in_peak",
        displayMode: "numeric",
        baseline: 280,
        scenario: 225,
        deltaLikely: 55,
        deltaLow: 30,
        deltaHigh: 80,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "high",
        assumptions: ["assumptions.air_exchange_closed"],
        sources: ["ASHRAE 62.2 Standard Infiltration"],
      },
      builtinExplanation: {
        actionId: "keep_windows_closed_in_peak",
        whatToDoKey: "builtin_explanations.keep_windows_closed_in_peak.what_to_do",
        whyItMattersKey: "builtin_explanations.keep_windows_closed_in_peak.why_it_matters",
        assumptionsKeys: [],
      },
    },
    {
      rank: 3,
      reasonKey: "reasons.severe_smog_mandatory_masking",
      group: "household",
      result: {
        actionId: "wear_fitted_respirator",
        displayMode: "numeric",
        baseline: 345,
        scenario: 260,
        deltaLikely: 85,
        deltaLow: 50,
        deltaHigh: 115,
        unit: "ug_m3",
        direction: "reduces",
        confidence: "medium",
        assumptions: ["assumptions.respirator_fit_is_critical_caveat"],
        sources: ["NIOSH N95 / EN 149 FFP2"],
      },
      builtinExplanation: {
        actionId: "wear_fitted_respirator",
        whatToDoKey: "builtin_explanations.wear_fitted_respirator.what_to_do",
        whyItMattersKey: "builtin_explanations.wear_fitted_respirator.why_it_matters",
        assumptionsKeys: [],
      },
    },
    {
      rank: 4,
      reasonKey: "reasons.community_clean_air_stewardship",
      group: "community",
      result: {
        actionId: "avoid_waste_and_biomass_burning",
        displayMode: "directional",
        direction: "reduces",
        confidence: "high",
        assumptions: ["assumptions.community_emission_curtailment"],
        sources: ["CPCB Air Pollution Control Guidance"],
      },
      builtinExplanation: {
        actionId: "avoid_waste_and_biomass_burning",
        whatToDoKey: "builtin_explanations.avoid_waste_and_biomass_burning.what_to_do",
        whyItMattersKey: "builtin_explanations.avoid_waste_and_biomass_burning.why_it_matters",
        assumptionsKeys: [],
      },
    },
  ],
  assumptions: [
    {
      key: "purifier_owned_cadr",
      status: "sourced",
      confidence: "high",
      source: "AHAM AC-1 / Manufacturer Specs",
      description: "Calculated using user-specified clean air delivery rate (CADR).",
    },
  ],
  safety: {
    disclaimerKey: "safety.disclaimer.general_guidance",
    medicalHelpKey: "safety.medical.seek_help_for_symptoms",
  },
};

test.describe("BreatheWise E2E User Journey & A11y Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all /api/* requests with deterministic fixtures
    await page.route("**/api/geocode*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            candidates: [
              {
                id: 1,
                label: "Anand Vihar, Delhi, India",
                lat: 28.6469,
                lng: 77.3164,
                timezone: "Asia/Kolkata",
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/advice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: mockAdviceData,
        }),
      });
    });

    await page.route("**/api/explain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            source: "builtin",
            summary: "Severe smog crisis detected. Stay indoors and seal windows.",
            perAction: [],
          },
        }),
      });
    });

    await page.route("**/api/ask", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            answer:
              "For two-wheeler commutes during severe smog, certified N95 or FFP2 respirators with an airtight perimeter seal provide critical barrier filtration against inhaled fine particulates.",
            explanationSource: "ai",
          },
        }),
      });
    });
  });

  test("runs complete user flow, keyboard pass, axe audit and captures screenshots", async ({
    page,
    isMobile,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Visit homepage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Initial Axe Audit (Home view)
    const initialAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousInitialViolations = initialAxe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousInitialViolations,
      `Initial view axe violations: ${JSON.stringify(seriousInitialViolations)}`,
    ).toEqual([]);

    // 2. Search for a location in the combobox
    const searchInput = page.getByRole("combobox", { name: /city or neighborhood/i });
    await expect(searchInput).toBeVisible();

    await searchInput.focus();
    await searchInput.fill("Anand Vihar");

    // Select the option from dropdown
    const option = page.getByRole("option", { name: /Anand Vihar/i });
    await expect(option).toBeVisible();
    await option.click();

    // 3. Verify Advice loads and displays Hero, Outlook, Timeline, Actions
    await expect(
      page.getByText(/Air in Anand Vihar, Delhi, India is Severe right now/i),
    ).toBeVisible();
    await expect(page.getByText(/345/i).first()).toBeVisible();
    await expect(page.getByText(/Local station reports 2.1× higher pollution/i)).toBeVisible();

    // 4. Expand an Action item to read assumptions disclosure
    const hepaDisclosureButton = page
      .getByRole("button", {
        name: /How we worked this out & assumptions/i,
      })
      .first();
    await expect(hepaDisclosureButton).toBeVisible();
    await hepaDisclosureButton.click();
    await expect(hepaDisclosureButton).toHaveAttribute("aria-expanded", "true");

    // 5. Ask Assistant interaction
    const askInput = page.getByPlaceholder(/Ask a question about today's smog/i).first();
    if (await askInput.isVisible()) {
      await askInput.fill("Which mask should I wear?");
      const askButton = page.getByRole("button", { name: "Ask", exact: true }).first();
      await askButton.click();
      await expect(page.getByText(/certified N95 or FFP2 respirators/i)).toBeVisible();
    }

    // Results Axe Audit
    const resultsAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousResultsViolations = resultsAxe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousResultsViolations,
      `Results view axe violations: ${JSON.stringify(seriousResultsViolations)}`,
    ).toEqual([]);

    // 6. Save Screenshots based on viewport
    if (isMobile) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.screenshot({ path: "docs/screenshots/mobile-results.png" });
      await page.screenshot({ path: "docs/screenshots/mobile-severe.png" });
    } else {
      await page.screenshot({ path: "docs/screenshots/desktop-results.png" });
    }

    // 7. Test Language Toggle to Hindi
    const langToggle = page.getByRole("button", { name: "हिन्दी" });
    if (await langToggle.isVisible()) {
      await langToggle.click();
      await expect(page.locator("html")).toHaveAttribute("lang", "hi");
      await expect(page.getByRole("button", { name: "English" })).toBeVisible();
      await expect(page.getByText(/यह कैसे काम करता है/i).first()).toBeVisible();

      if (isMobile) {
        await page.screenshot({ path: "docs/screenshots/mobile-hindi-390.png" });

        // Test narrow 320px viewport
        await page.setViewportSize({ width: 320, height: 600 });
        await page.screenshot({ path: "docs/screenshots/mobile-hindi-320.png" });
        await page.setViewportSize({ width: 390, height: 844 });
      }
    }

    // 8. Visit About Page and verify Axe
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/How BreatheWise Works/i)).toBeVisible();

    const aboutAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousAboutViolations = aboutAxe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousAboutViolations,
      `About page axe violations: ${JSON.stringify(seriousAboutViolations)}`,
    ).toEqual([]);

    if (isMobile) {
      await page.screenshot({ path: "docs/screenshots/mobile-about.png" });
    } else {
      await page.screenshot({ path: "docs/screenshots/desktop-about.png" });

      // Generate print-plan.pdf in desktop project
      await page.goto("/");
      await searchInput.focus();
      await searchInput.fill("Anand Vihar");
      await option.click();
      await expect(page.getByText(/Air in Anand Vihar/i)).toBeVisible();

      await page.emulateMedia({ media: "print" });
      await page.pdf({
        path: "docs/screenshots/print-plan.pdf",
        format: "A4",
        printBackground: true,
      });
    }

    // Assert zero console errors
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("Content-Security-Policy"),
    );
    expect(fatalErrors).toEqual([]);
  });

  test("handles air unavailable state cleanly and captures screenshot", async ({
    page,
    isMobile,
  }) => {
    await page.route("**/api/advice", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "upstream_unavailable",
            message: "Air quality data is currently unavailable for this region.",
          },
        }),
      });
    });

    await page.goto("/");
    const searchInput = page.getByRole("combobox", { name: /city or neighborhood/i });
    await searchInput.fill("Anand Vihar");
    const option = page.getByRole("option", { name: /Anand Vihar/i });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByRole("alert").filter({ hasText: /Air quality data/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Retry Loading/i })).toBeVisible();

    if (isMobile) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.screenshot({ path: "docs/screenshots/mobile-air-unavailable.png" });
    }
  });
});
