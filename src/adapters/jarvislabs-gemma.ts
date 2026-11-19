import type {
  ExplanationRequest,
  ExplanationResponse,
  Language,
  LlmClient,
  ProviderError,
  PurifierLabelResult,
  QuestionLlmRequest,
  Result,
} from "../core";
import { cfmToM3h, err, ok } from "../core";
import { logger } from "../lib/logger";
import { fetchJson } from "./http";
import { buildAskPrompt } from "./prompts/ask";
import { buildExplanationPrompt, ExplanationOutputSchema } from "./prompts/explanation";
import {
  buildProfileParserPrompt,
  ParsedProfileData,
  ParsedProfileDataSchema,
} from "./prompts/profile-parser";
import { buildPurifierLabelPrompt, PurifierLabelOutputSchema } from "./prompts/purifier-label";
import { Semaphore } from "./semaphore";
import { ChatCompletionResponseSchema, tryParseJson } from "./llm-helpers";

export interface JarvisLabsGemmaConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly maxConcurrency?: number;
  readonly fetchFn?: typeof fetch;
}

/**
 * Adapter implementing the LlmClient port for Google Gemma 4 31B IT hosted on Jarvis Labs.
 */
export class JarvisLabsGemmaAdapter implements LlmClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly semaphore: Semaphore;
  private readonly fetchFn?: typeof fetch;

  public constructor(config: JarvisLabsGemmaConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://models.jarvislabs.net/v1";
    this.model = config.model ?? "gemma-4-31b-it";
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.semaphore = new Semaphore(config.maxConcurrency ?? 4);
    this.fetchFn = config.fetchFn;
  }

  private async executeChat(
    messages: Array<{ role: string; content: string | unknown[] }>,
    maxTokens = 2500,
  ): Promise<Result<{ content: string; finishReason?: string }, ProviderError>> {
    if (!this.apiKey || this.apiKey.trim() === "") {
      return err({
        code: "misconfigured",
        message: "JARVISLABS_API_KEY is missing or not configured",
        retryable: false,
      });
    }

    await this.semaphore.acquire();
    const start = Date.now();

    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body = JSON.stringify({
        model: this.model,
        messages,
        chat_template_kwargs: { enable_thinking: false },
        max_tokens: maxTokens,
        temperature: 0.2,
      });

      const res = await fetchJson(url, {
        method: "POST",
        schema: ChatCompletionResponseSchema,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        timeoutMs: this.timeoutMs,
        retries: 1,
        fetchFn: this.fetchFn,
      });

      if (!res.ok) return res;

      const choice = res.value.choices[0];
      if (!choice || !choice.message.content) {
        return err({
          code: "invalid_response",
          message: "Empty completion returned from LLM provider",
          retryable: false,
        });
      }

      logger.info("LLM generation finished", {
        model: this.model,
        durationMs: Date.now() - start,
        prompt_tokens: res.value.usage?.prompt_tokens,
        completion_tokens: res.value.usage?.completion_tokens,
      });

      return ok({
        content: choice.message.content,
        finishReason: choice.finish_reason ?? undefined,
      });
    } finally {
      this.semaphore.release();
    }
  }

  public async generateExplanation(
    request: ExplanationRequest,
  ): Promise<Result<ExplanationResponse, ProviderError>> {
    const { system, user } = buildExplanationPrompt(request);
    let messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    let result = await this.executeChat(messages, 2500);
    if (!result.ok) return result;

    if (result.value.finishReason === "length") {
      result = await this.executeChat(messages, 3500);
      if (!result.ok) return result;
    }

    let parsed = ExplanationOutputSchema.safeParse(tryParseJson(result.value.content));
    if (!parsed.success) {
      // One repair retry
      messages = [
        ...messages,
        { role: "assistant", content: result.value.content },
        {
          role: "user",
          content:
            "Your response was not valid JSON. Return ONLY the strict JSON object with narrative and actionCommentaries.",
        },
      ];
      result = await this.executeChat(messages, 2500);
      if (!result.ok) return result;
      parsed = ExplanationOutputSchema.safeParse(tryParseJson(result.value.content));
    }

    if (!parsed.success) {
      return err({
        code: "invalid_response",
        message: `Failed to parse explanation JSON from model: ${parsed.error.message}`,
        retryable: false,
      });
    }

    const { narrative, actionCommentaries } = parsed.data;

    return ok({
      narrative,
      actionCommentaries,
      language: request.language,
      modelUsed: this.model,
    });
  }

  public async parseProfile(
    freeText: string,
    language: Language = "en",
  ): Promise<Result<ParsedProfileData, ProviderError>> {
    const { system, user } = buildProfileParserPrompt(freeText, language);
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const result = await this.executeChat(messages, 1500);
    if (!result.ok) return result;

    const parsed = ParsedProfileDataSchema.safeParse(tryParseJson(result.value.content));
    if (!parsed.success) {
      return err({
        code: "invalid_response",
        message: `Failed to validate parsed profile JSON: ${parsed.error.message}`,
        retryable: false,
      });
    }
    return ok(parsed.data);
  }

  public async answer(request: QuestionLlmRequest): Promise<Result<string, ProviderError>> {
    const { systemPrompt, userMessage } = buildAskPrompt(request);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];
    const result = await this.executeChat(messages, 1000);
    if (!result.ok) return result;
    return ok(result.value.content.trim());
  }

  public async readPurifierLabel(
    imageBase64: string,
    mimeType: string,
  ): Promise<Result<PurifierLabelResult, ProviderError>> {
    const { system, userContent } = buildPurifierLabelPrompt(imageBase64, mimeType);
    const messages = [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ];
    const result = await this.executeChat(messages, 800);
    if (!result.ok) return result;

    const parsed = PurifierLabelOutputSchema.safeParse(tryParseJson(result.value.content));
    if (!parsed.success) {
      return err({
        code: "invalid_response",
        message: `Failed to validate purifier label JSON: ${parsed.error.message}`,
        retryable: false,
      });
    }

    const { cadr, unit, brand, model, confidence } = parsed.data;
    let cadrM3h: number | null = cadr;
    if (cadr !== null && unit === "cfm") {
      cadrM3h = cfmToM3h(cadr);
    }

    return ok({
      cadrM3h,
      rawCadr: cadr,
      unit,
      brand: brand ?? undefined,
      model: model ?? undefined,
      confidence,
    });
  }
}
