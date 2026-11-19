import { z } from "zod";
import type { ExplanationRequest } from "../../core/ports";

export const ExplanationOutputSchema = z.object({
  narrative: z.string().min(1),
  actionCommentaries: z.array(
    z.object({
      actionId: z.string(),
      commentary: z.string().min(1),
    }),
  ),
});

export type ExplanationOutput = z.infer<typeof ExplanationOutputSchema>;

export function buildExplanationPrompt(request: ExplanationRequest): {
  system: string;
  user: string;
} {
  const isHindi = request.language === "hi";

  const system = [
    "You are BreatheWise, an empathetic, scientifically grounded urban air quality assistant.",
    "Your mission is to guide families through hazardous winter smog by explaining pre-computed intervention impacts.",
    "",
    "CRITICAL HONESTY & INTEGRITY RULES:",
    "1. NEVER invent, extrapolate, or compute new numbers, percentages, or health statistics.",
    "2. ONLY cite the exact numbers explicitly provided in the computed results below.",
    "3. Never mention CO2e or percentage mask efficiencies unless given in the numbers.",
    "4. For actions marked with displayMode 'directional' or 'myth-check', provide ONLY qualitative guidance (e.g. 'reduces particulate inhalation', 'plants have negligible impact'). Do NOT assign numbers to them.",
    "5. Explain trade-offs clearly, prioritizing vulnerable family members (children, elderly, respiratory conditions) without clinical medical claims.",
    isHindi
      ? "6. Output all narrative and commentaries in natural, clear Hindi (Devanagari script)."
      : "6. Output all narrative and commentaries in clear, accessible English.",
    "",
    "Output must be a valid JSON object matching this schema exactly:",
    '{ "narrative": "overall guidance summary", "actionCommentaries": [{ "actionId": "string", "commentary": "action-specific advice" }] }',
    "Return ONLY raw JSON, with no markdown code blocks or surrounding text.",
  ].join("\n");

  const impacts = request.impactResults ?? request.results ?? [];
  const resultsSummary = impacts.map((r) => ({
    actionId: r.actionId,
    displayMode: r.displayMode,
    baseline: r.baseline,
    scenario: r.scenario,
    deltaLow: r.deltaLow,
    deltaLikely: r.deltaLikely,
    deltaHigh: r.deltaHigh,
    direction: r.direction,
    unit: r.unit,
    confidence: r.confidence,
    assumptions: r.assumptions,
  }));

  const loc = request.scenarioContext?.locationLabel ?? request.placeLabel ?? "Local Region";
  const commute = request.scenarioContext?.commuteMode ?? "general";
  const windows = request.scenarioContext?.windowsHabit ?? "general";
  const cooking = request.scenarioContext?.cookingFuel ?? "general";

  const user = [
    `Household Location: ${loc}`,
    `Commute Mode: ${commute}`,
    `Windows Habit: ${windows}`,
    `Cooking Fuel: ${cooking}`,
    "",
    "Computed Impact Results:",
    JSON.stringify(resultsSummary, null, 2),
    "",
    ...(request.disallowedTokens && request.disallowedTokens.length > 0
      ? [
          `STRICT CORRECTION: Your previous response included unauthorized numbers: [${request.disallowedTokens.join(
            ", ",
          )}]. You must NOT cite or mention these or any other unauthorized numbers. Cite ONLY the numbers explicitly shown in the results above.`,
          "",
        ]
      : []),
    "Please synthesize the narrative and action commentaries now.",
  ].join("\n");

  return { system, user };
}
