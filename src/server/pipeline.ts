import type { AdviceResponse, ApplicationError, ExplanationRequest, Result } from "@/core";
import { err, ok } from "@/core";
import { findDisallowedNumbers } from "@/core/numbers";
import { computeAdviceData } from "./pipeline-compute";
import {
  buildBuiltinAiFallbackExplanation,
  buildGroundingSummary,
  collectPipelineAllowedNumbers,
} from "./pipeline-helpers";
import type {
  AdviceRequest,
  PipelineDependencies,
  QuestionRequest,
  QuestionResponse,
} from "./pipeline-types";
import { checkSafety } from "./safety";

export class Pipeline {
  public constructor(private readonly deps: PipelineDependencies) {}

  /**
   * Orchestrates the fast advice path.
   * Note: This method is asynchronous because it performs parallel I/O to fetch external air quality
   * and weather snapshots via cached adapters. Its underlying computational engine (`computeAdviceData`)
   * is pure, deterministic, and executes in <10ms.
   *
   * @param request - Household profile and optional timestamp.
   * @returns Result containing the full computed AdviceResponse.
   */
  public async buildAdvice(
    request: AdviceRequest,
  ): Promise<Result<AdviceResponse, ApplicationError>> {
    return computeAdviceData(this.deps, request);
  }

  public async explainAdvice(
    request: AdviceRequest,
  ): Promise<Result<AdviceResponse, ApplicationError>> {
    const computedRes = await computeAdviceData(this.deps, request);
    if (!computedRes.ok) return computedRes;
    const advice = { ...computedRes.value };

    if (advice.dataStatus === "unavailable" || !this.deps.llm) {
      advice.explanation = buildBuiltinAiFallbackExplanation(advice);
      return ok(advice);
    }

    const isVulnerable =
      request.profile.household.childrenAgeBands.length > 0 ||
      request.profile.household.hasElderly ||
      request.profile.household.hasRespiratoryCondition;

    // Privacy Minimisation: Only category, boolean flags, place label, impacts, and language.
    // Never user coordinates, ages, or raw profile text.
    const llmReq: ExplanationRequest = {
      category: advice.airQuality.reading.category,
      vulnerable: isVulnerable,
      placeLabel: advice.location.label,
      results: advice.actions.map((a) => a.result),
      language: request.profile.language,
    };

    let llmRes = await this.deps.llm.generateExplanation(llmReq);
    if (!llmRes.ok) {
      advice.explanation = buildBuiltinAiFallbackExplanation(advice);
      return ok(advice);
    }

    const allowed = collectPipelineAllowedNumbers(advice);
    let disallowed = findDisallowedNumbers(llmRes.value.narrative, allowed);

    if (disallowed.length > 0) {
      // Guard 2: Whitelist violation -> One regenerate retry with stricter instruction listing tokens
      llmRes = await this.deps.llm.generateExplanation({
        ...llmReq,
        disallowedTokens: disallowed.map(String),
      });
      if (llmRes.ok) {
        disallowed = findDisallowedNumbers(llmRes.value.narrative, allowed);
      }
    }

    if (!llmRes.ok || disallowed.length > 0) {
      advice.explanation = buildBuiltinAiFallbackExplanation(advice);
      return ok(advice);
    }

    // Guard 3: Content Safety filter
    const fullNarrative = `${llmRes.value.narrative} ${llmRes.value.actionCommentaries.map((c) => c.commentary).join(" ")}`;
    if (!checkSafety(fullNarrative).isSafe) {
      advice.explanation = buildBuiltinAiFallbackExplanation(advice);
      return ok(advice);
    }

    advice.explanation = {
      source: "ai",
      summary: llmRes.value.narrative,
      perAction: llmRes.value.actionCommentaries.map((c) => ({
        actionId: c.actionId,
        text: c.commentary,
      })),
    };

    return ok(advice);
  }

  public async answerQuestion(
    request: QuestionRequest,
  ): Promise<Result<QuestionResponse, ApplicationError>> {
    const adviceRes = await computeAdviceData(this.deps, request);
    if (!adviceRes.ok) return adviceRes;
    const advice = adviceRes.value;

    if (!this.deps.llm?.answer) {
      return err({
        code: "assistant_unavailable",
        message: "AI assistant is not configured or unavailable",
      });
    }

    const groundingContext = buildGroundingSummary(advice);
    const ansRes = await this.deps.llm.answer({
      groundingContext,
      question: request.question,
      priorTurns: request.priorTurns,
      language: request.profile.language,
    });

    if (!ansRes.ok) {
      return err({ code: "assistant_unavailable", message: ansRes.error.message });
    }

    let text = ansRes.value;

    // Guard 2: Number whitelist check
    const allowed = collectPipelineAllowedNumbers(advice);
    let disallowed = findDisallowedNumbers(text, allowed);

    if (disallowed.length > 0) {
      // Whitelist violation -> One regenerate retry with stricter instruction listing tokens
      const retryRes = await this.deps.llm.answer({
        groundingContext,
        question: `${request.question}\n(Do not cite unauthorized numbers: ${disallowed.join(", ")})`,
        priorTurns: request.priorTurns,
        language: request.profile.language,
      });
      if (retryRes.ok) {
        text = retryRes.value;
        disallowed = findDisallowedNumbers(text, allowed);
      }
    }

    if (disallowed.length > 0) {
      return ok({
        answer:
          "Please refer to the built-in numerical recommendations above for exposure estimates.",
        explanationSource: "builtin",
      });
    }

    // Guard 3: Content Safety filter
    if (!checkSafety(text).isSafe) {
      return ok({
        answer:
          "I can only offer exposure reduction engineering guidance. Please consult a qualified medical professional for health symptoms or clinical treatment.",
        explanationSource: "builtin",
        declined: true,
        reasonKey: "safety.medical.seek_help_for_symptoms",
        safetyNoticeKey: "safety.medical.seek_help_for_symptoms",
      });
    }

    if (
      text.toLowerCase().includes("cannot answer questions outside") ||
      text.toLowerCase().includes("off-topic")
    ) {
      return ok({
        declined: true,
        reasonKey: "safety.off_topic",
        explanationSource: "builtin",
      });
    }

    return ok({ answer: text, explanationSource: "ai" });
  }
}

export function createPipeline(deps: PipelineDependencies): Pipeline {
  return new Pipeline(deps);
}
