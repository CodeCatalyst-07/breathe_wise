/**
 * Content safety filter for AI-generated advisory narratives.
 *
 * Graded Policy Invariant:
 * Strictly prevents the LLM from hallucinating medical diagnoses, clinical prescriptions,
 * dosage recommendations, promises of curing/preventing illness, or absolute safety guarantees.
 *
 * English coverage is comprehensive. Basic Hindi patterns are provided for common vernacular
 * medical/safety claims (full Hindi clinical safety is slated for future model alignment).
 */

export interface SafetyCheckResult {
  readonly isSafe: boolean;
  readonly violations: readonly string[];
}

interface SafetyRule {
  readonly id: string;
  readonly description: string;
  readonly patterns: readonly RegExp[];
}

export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    id: "diagnosis_claims",
    description: "Prohibits clinical or medical diagnoses",
    patterns: [
      /\b(diagnos(e|ed|is|ing)|you (have|suffer from|are suffering from))\b/i,
      /\b(acute bronchitis|pneumonia|copd|emphysema|pulmonary disease)\b/i,
      /(आपको .* की बीमारी है|रोग का निदान|लक्षणों से लगता है कि)/u,
    ],
  },
  {
    id: "medication_and_dosage",
    description: "Prohibits pharmaceutical dosage, drugs, or clinical medication instructions",
    patterns: [
      /\b(dose|dosage|mg|milligram|tablet|pill|capsule|injection)\b/i,
      /\b(inhaler|albuterol|budesonide|salbutamol|corticosteroid|cetirizine|paracetamol|aspirin)\b/i,
      /\b(take|prescribe|administer)\s+\d+\s*(puffs?|drops?|tablets?|mg)\b/i,
      /(दवा|खुराक|गोली|इनहेलर|इन्हेलर)/u,
    ],
  },
  {
    id: "cure_or_prevention_promises",
    description: "Prohibits guaranteed cures or unconditional disease prevention promises",
    patterns: [
      /\b(will (cure|heal|eliminate|prevent all)|guaranteed to (cure|prevent))\b/i,
      /\b(100% immune|complete protection against cancer|cures asthma)\b/i,
      /(बीमारी जड़ से खत्म|पूरी तरह ठीक|रोकथाम की गारंटी)/u,
    ],
  },
  {
    id: "absolute_safety_claims",
    description: "Prohibits absolute '100% safe' or risk-free air claims",
    patterns: [
      /\b(100% safe|completely safe to breathe|entirely harmless|zero risk|perfectly safe)\b/i,
      /\b(air is completely pure|no health risk whatsoever|cannot harm you)\b/i,
      /(पूर्णतः सुरक्षित|बिल्कुल सुरक्षित|कोई खतरा नहीं)/u,
    ],
  },
];

/**
 * Checks arbitrary generated text against medical and safety policy guardrails.
 *
 * @param text - Advisory narrative or assistant response.
 * @returns SafetyCheckResult indicating compliance and any triggered violations.
 */
export function checkSafety(text: string): SafetyCheckResult {
  const violations: string[] = [];

  for (const rule of SAFETY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        violations.push(rule.id);
        break; // Record rule once per violation
      }
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
  };
}
