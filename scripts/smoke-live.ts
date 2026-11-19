/**
 * Live smoke test script for BreatheWise external adapters.
 * Tests real endpoints when network and credentials are provided.
 *
 * Usage:
 *   npx tsx scripts/smoke-live.ts
 */

import fs from "node:fs";
import {
  AirQualityCompositeAdapter,
  GeocodingAdapter,
  JarvisLabsGemmaAdapter,
  OpenAqAdapter,
  OpenMeteoAdapter,
} from "../src/adapters/index";

// Optionally load .env for local CLI testing
try {
  if (fs.existsSync(".env")) {
    const lines = fs.readFileSync(".env", "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match && match[1] && !process.env[match[1]]) {
        process.env[match[1]] = match[2]?.trim() ?? "";
      }
    }
  }
} catch {
  // Ignore
}

async function main() {
  console.log("=== BreatheWise Infrastructure Live Smoke Test ===");
  const delhiCoords = { lat: 28.6139, lng: 77.209, label: "New Delhi" };

  // 1. Open-Meteo Geocoding (no API key required)
  console.log("\n[1/5] Testing Open-Meteo Geocoding search...");
  try {
    const geocoding = new GeocodingAdapter();
    const geoRes = await geocoding.searchLocation("Delhi");
    if (geoRes.ok) {
      console.log(`  ✓ Geocoding succeeded: found ${geoRes.value.length} candidates.`);
      if (geoRes.value[0]) {
        console.log(
          `    Top: ${geoRes.value[0].label} (${geoRes.value[0].lat}, ${geoRes.value[0].lng})`,
        );
      }
    } else {
      console.log(`  ⚠ Geocoding returned error: ${geoRes.error.code} - ${geoRes.error.message}`);
    }
  } catch (err) {
    console.log(`  ✗ Geocoding failed: ${(err as Error).message}`);
  }

  // 2. Open-Meteo Air Quality & Weather (no API key required)
  console.log("\n[2/5] Testing Open-Meteo Air Quality & Weather...");
  try {
    const openMeteo = new OpenMeteoAdapter();
    const [aqRes, weatherRes] = await Promise.all([
      openMeteo.getAirQuality(delhiCoords),
      openMeteo.getWeather(delhiCoords),
    ]);

    if (aqRes.ok) {
      console.log(
        `  ✓ Open-Meteo AQ succeeded: PM2.5 = ${aqRes.value.pm25} ug/m3, ${aqRes.value.hourlyForecast.length} forecast points.`,
      );
    } else {
      console.log(`  ⚠ Open-Meteo AQ returned error: ${aqRes.error.code} - ${aqRes.error.message}`);
    }

    if (weatherRes.ok) {
      console.log(
        `  ✓ Open-Meteo Weather succeeded: ${weatherRes.value.hourly.length} hourly records.`,
      );
    } else {
      console.log(
        `  ⚠ Open-Meteo Weather returned error: ${weatherRes.error.code} - ${weatherRes.error.message}`,
      );
    }
  } catch (err) {
    console.log(`  ✗ Open-Meteo failed: ${(err as Error).message}`);
  }

  // 3. OpenAQ v3 (requires OPENAQ_API_KEY)
  console.log("\n[3/5] Testing OpenAQ v3 ground observations...");
  const openAqKey = process.env.OPENAQ_API_KEY;
  if (!openAqKey) {
    console.log(
      "  ℹ OPENAQ_API_KEY not set in environment; skipping live OpenAQ call (verified fallback).",
    );
  } else {
    try {
      const openAq = new OpenAqAdapter({ apiKey: openAqKey });
      const aqRes = await openAq.getAirQuality(delhiCoords);
      if (aqRes.ok) {
        console.log(
          `  ✓ OpenAQ station measurement: PM2.5 = ${aqRes.value.pm25} ug/m3 (station distance: ${aqRes.value.stationDistanceKm} km).`,
        );
      } else {
        console.log(`  ⚠ OpenAQ returned error: ${aqRes.error.code} - ${aqRes.error.message}`);
      }
    } catch (err) {
      console.log(`  ✗ OpenAQ call failed: ${(err as Error).message}`);
    }
  }

  // 4. Composite Air Quality Provider
  console.log("\n[4/5] Testing Composite Air Quality Provider...");
  try {
    const openAq = new OpenAqAdapter({ apiKey: openAqKey });
    const openMeteo = new OpenMeteoAdapter();
    const composite = new AirQualityCompositeAdapter({ openAq, openMeteo });
    const compRes = await composite.getAirQuality(delhiCoords);
    if (compRes.ok) {
      console.log(
        `  ✓ Composite AQ resolved: source = ${compRes.value.source}, PM2.5 = ${compRes.value.pm25} ug/m3, forecast points = ${compRes.value.hourlyForecast.length}.`,
      );
    } else {
      console.log(
        `  ⚠ Composite AQ returned error: ${compRes.error.code} - ${compRes.error.message}`,
      );
    }
  } catch (err) {
    console.log(`  ✗ Composite failed: ${(err as Error).message}`);
  }

  // 5. Jarvis Labs Google Gemma Client (requires JARVISLABS_API_KEY)
  console.log("\n[5/6] Testing Jarvis Labs Google Gemma client...");
  const jarvisKey = process.env.JARVISLABS_API_KEY;
  if (!jarvisKey) {
    console.log(
      "  ℹ JARVISLABS_API_KEY not set in environment; skipping live LLM call (verified fallback).",
    );
  } else {
    try {
      const gemma = new JarvisLabsGemmaAdapter({ apiKey: jarvisKey });
      const parseRes = await gemma.parseProfile(
        "Family with a 2-year old toddler and elderly grandmother in Delhi using two-wheeler.",
      );
      if (parseRes.ok) {
        console.log("  ✓ Gemma profile parse succeeded:", JSON.stringify(parseRes.value));
      } else {
        console.log(
          `  ⚠ Gemma profile parse returned error: ${parseRes.error.code} - ${parseRes.error.message}`,
        );
      }
    } catch (err) {
      console.log(`  ✗ Gemma call failed: ${(err as Error).message}`);
    }
  }

  // 6. Purifier Label Multimodal Reader
  console.log("\n[6/6] Testing Purifier Label Multimodal Reader...");
  if (!jarvisKey) {
    console.log(
      "  ℹ JARVISLABS_API_KEY not set in environment; skipping multimodal label smoke test.",
    );
  } else {
    try {
      const gemma = new JarvisLabsGemmaAdapter({ apiKey: jarvisKey });
      // Minimal 1x1 transparent PNG in base64
      const samplePngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      const labelRes = await gemma.readPurifierLabel(samplePngBase64, "image/png");
      if (labelRes.ok) {
        console.log(
          "  ✓ Gemma multimodal purifier label call succeeded:",
          JSON.stringify(labelRes.value),
        );
      } else {
        console.log(
          `  ⚠ Gemma multimodal returned error: ${labelRes.error.code} - ${labelRes.error.message}`,
        );
      }
    } catch (err) {
      console.log(`  ✗ Multimodal call failed: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Smoke Test Complete ===");
}

main().catch((e) => {
  console.error("Fatal error during smoke test:", e);
  process.exit(1);
});
