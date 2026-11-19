import { describe, expect, it } from "vitest";
import { checkSafety } from "@/server/safety";

describe("Content Safety Filter", () => {
  it("passes safe exposure reduction engineering advice", () => {
    const text =
      "Keeping windows closed during morning rush hours reduces indoor particulate infiltration. Operating a HEPA air purifier can lower PM2.5 levels by approximately 45 µg/m³.";
    const res = checkSafety(text);
    expect(res.isSafe).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it("detects and flags diagnosis claims in English and Hindi", () => {
    const en = "Based on your cough, you have acute bronchitis and should rest.";
    const hi = "आपके लक्षणों से लगता है कि आपको सांस की गंभीर बीमारी है।";

    expect(checkSafety(en).isSafe).toBe(false);
    expect(checkSafety(en).violations).toContain("diagnosis_claims");

    expect(checkSafety(hi).isSafe).toBe(false);
    expect(checkSafety(hi).violations).toContain("diagnosis_claims");
  });

  it("detects and flags medication and dosage instructions in English and Hindi", () => {
    const en1 = "Take 10mg of cetirizine before heading outside.";
    const en2 = "Use your albuterol inhaler 2 puffs before jogging.";
    const hi = "प्रदूषण से बचने के लिए रोज यह दवा लें।";

    expect(checkSafety(en1).isSafe).toBe(false);
    expect(checkSafety(en1).violations).toContain("medication_and_dosage");

    expect(checkSafety(en2).isSafe).toBe(false);
    expect(checkSafety(en2).violations).toContain("medication_and_dosage");

    expect(checkSafety(hi).isSafe).toBe(false);
    expect(checkSafety(hi).violations).toContain("medication_and_dosage");
  });

  it("detects and flags cure or guaranteed disease prevention promises", () => {
    const en =
      "Using this N95 mask will cure your cough and give complete protection against cancer.";
    const hi = "यह उपाय करने से बीमारी जड़ से खत्म हो जाएगी।";

    expect(checkSafety(en).isSafe).toBe(false);
    expect(checkSafety(en).violations).toContain("cure_or_prevention_promises");

    expect(checkSafety(hi).isSafe).toBe(false);
    expect(checkSafety(hi).violations).toContain("cure_or_prevention_promises");
  });

  it("detects and flags absolute safe claims", () => {
    const en = "The air in your bedroom is 100% safe to breathe with zero risk.";
    const hi = "कमरे के अंदर की हवा पूर्णतः सुरक्षित है और कोई खतरा नहीं है।";

    expect(checkSafety(en).isSafe).toBe(false);
    expect(checkSafety(en).violations).toContain("absolute_safety_claims");

    expect(checkSafety(hi).isSafe).toBe(false);
    expect(checkSafety(hi).violations).toContain("absolute_safety_claims");
  });
});
