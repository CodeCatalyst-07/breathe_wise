/**
 * Smoke script for the BreatheWise HTTP API Layer.
 * Tests endpoints against a running server (default http://localhost:3000).
 *
 * Security Invariant: NEVER prints secret keys, auth tokens, or private environment variables.
 */

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const SAMPLE_PROFILE = {
  location: {
    lat: 28.6139,
    lng: 77.209,
    label: "Delhi Central",
    timezone: "Asia/Kolkata",
  },
  household: {
    childrenAgeBands: ["0-2", "6-12"],
    hasElderly: true,
    hasRespiratoryCondition: true,
  },
  commuteMode: "auto_rickshaw",
  home: {
    roomVolumeM3: 45,
    windowsHabit: "closed_all_day",
    purifierCadrM3h: 250,
    cookingFuel: "lpg",
  },
  budgetInr: 5000,
  language: "en",
};

interface TestResult {
  route: string;
  status: number;
  durationMs: number;
  summary: string;
}

async function testRoute(
  name: string,
  fn: () => Promise<{ status: number; summary: string }>,
): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fn();
    return {
      route: name,
      status: res.status,
      durationMs: Date.now() - start,
      summary: res.summary,
    };
  } catch (err: unknown) {
    return {
      route: name,
      status: 0,
      durationMs: Date.now() - start,
      summary: `Failed: ${(err as Error).message}`,
    };
  }
}

async function run(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(` BreatheWise HTTP API Smoke Test (${BASE_URL})`);
  console.log(`======================================================\n`);

  const results: TestResult[] = [];

  // 1. Health
  results.push(
    await testRoute("GET /api/health", async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const json = (await res.json()) as { status?: string };
      return { status: res.status, summary: `Health status: ${json.status}` };
    }),
  );

  // 2. Geocode
  results.push(
    await testRoute("GET /api/geocode?q=Delhi", async () => {
      const res = await fetch(`${BASE_URL}/api/geocode?q=Delhi`);
      const json = (await res.json()) as { candidates?: Array<{ label: string }> };
      const topLabel = json.candidates?.[0]?.label ?? "none";
      return {
        status: res.status,
        summary: `Found ${json.candidates?.length ?? 0} candidates, top: "${topLabel}"`,
      };
    }),
  );

  // 3. Advice
  results.push(
    await testRoute("POST /api/advice", async () => {
      const res = await fetch(`${BASE_URL}/api/advice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: SAMPLE_PROFILE }),
      });
      const json = (await res.json()) as {
        dataStatus?: string;
        airQuality?: { reading?: { category: string; pm25: number } };
        actions?: unknown[];
      };
      const cat = json.airQuality?.reading?.category ?? "unknown";
      const pm25 = json.airQuality?.reading?.pm25 ?? "unknown";
      return {
        status: res.status,
        summary: `Status: ${json.dataStatus}, Category: ${cat} (${pm25} ug/m3), Actions: ${json.actions?.length ?? 0}`,
      };
    }),
  );

  // 4. Explain
  results.push(
    await testRoute("POST /api/explain", async () => {
      const res = await fetch(`${BASE_URL}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: SAMPLE_PROFILE }),
      });
      const json = (await res.json()) as {
        explanation?: { source?: string };
      };
      return {
        status: res.status,
        summary: `Explanation Source: ${json.explanation?.source ?? "none"}`,
      };
    }),
  );

  // 5. Ask
  results.push(
    await testRoute("POST /api/ask", async () => {
      const res = await fetch(`${BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: SAMPLE_PROFILE,
          question: "When is the safest time to go for a brisk walk?",
        }),
      });
      const json = (await res.json()) as {
        explanationSource?: string;
        declined?: boolean;
      };
      return {
        status: res.status,
        summary: `Source: ${json.explanationSource ?? "declined"}, Declined: ${Boolean(json.declined)}`,
      };
    }),
  );

  // Print Summary Table
  console.table(
    results.map((r) => ({
      Route: r.route,
      HTTP: r.status,
      "Duration (ms)": r.durationMs,
      Summary: r.summary,
    })),
  );

  const allPassed = results.every((r) => r.status >= 200 && r.status < 400);
  console.log(`\nOverall Smoke Result: ${allPassed ? "PASS" : "FAIL"}\n`);
}

void run();
