"use client";

import React, { useState } from "react";
import type { HouseholdProfile, Language } from "@/core/types";
import { t } from "@/lib/i18n";
import { fetchAsk, ApiClientError } from "@/lib/api-client";

interface AskPanelProps {
  profile: HouseholdProfile;
  language?: Language;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  isDeclined?: boolean;
}

const MAX_CHARS = 300;

export const AskPanel: React.FC<AskPanelProps> = ({ profile, language = "en" }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  const chips = [
    t("ui.ask.chip1", undefined, language),
    t("ui.ask.chip2", undefined, language),
    t("ui.ask.chip3", undefined, language),
  ];

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading || rateLimitTimer !== null) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Only send valid conversational turns, excluding error cards
      const history = messages
        .filter((m) => !m.isDeclined && !m.id.startsWith("err-") && m.text.trim().length > 0)
        .slice(-3)
        .map((m) => ({
          role: m.sender,
          text: m.text.trim().slice(0, 1500),
        }));
      const res = await fetchAsk(trimmed, profile, history);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "assistant",
        text:
          res.answer ||
          (res.reasonKey ? t(res.reasonKey, undefined, language) : "No answer available."),
        isDeclined: res.declined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      let userFriendlyError = "Assistant is currently unavailable. Please try again shortly.";

      if (err instanceof ApiClientError) {
        if (err.httpStatus === 429) {
          const secs = err.retryAfterSeconds ?? 30;
          setRateLimitTimer(secs);
          const timer = setInterval(() => {
            setRateLimitTimer((prev) => {
              if (prev === null || prev <= 1) {
                clearInterval(timer);
                return null;
              }
              return prev - 1;
            });
          }, 1000);
          userFriendlyError = `Rate limit reached. Please wait ${secs} seconds before asking again.`;
        } else if (err.httpStatus >= 500) {
          userFriendlyError =
            "Assistant service is momentarily busy. Please try again in a moment.";
        } else if (err.message && !err.message.toLowerCase().includes("payload structure")) {
          userFriendlyError = err.message;
        }
      } else if (
        err instanceof Error &&
        err.message &&
        !err.message.toLowerCase().includes("payload structure")
      ) {
        userFriendlyError = err.message;
      }

      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: userFriendlyError,
        isDeclined: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="ask-heading"
      className="w-full bg-surface rounded-panel border border-line p-5 sm:p-6 shadow-sm flex flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 id="ask-heading" className="text-lg font-serif font-bold text-ink">
            💡 {t("ui.ask.title", undefined, language)}
          </h2>
          <span className="text-[11px] font-medium text-action bg-action/10 px-2 py-0.5 rounded-chip">
            {t("ui.ask.assistantBadge", undefined, language)}
          </span>
        </div>
        <p className="text-xs text-ink-muted">{t("ui.ask.subtitle", undefined, language)}</p>
      </header>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading || rateLimitTimer !== null}
            onClick={() => handleAsk(chip)}
            className="text-xs px-3 py-1.5 rounded-chip border border-line bg-paper/60 text-ink hover:border-action hover:text-action disabled:opacity-50 transition-colors text-left"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Conversation Log */}
      <div
        role="log"
        aria-live="polite"
        className="flex flex-col gap-3 min-h-[120px] max-h-80 overflow-y-auto p-3 rounded-control bg-paper/40 border border-line/60"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-ink-muted m-auto italic">
            {t("ui.ask.placeholder", undefined, language)}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col text-xs leading-relaxed max-w-[88%] p-3 rounded-panel ${
                m.sender === "user"
                  ? "self-end bg-action text-white rounded-br-none"
                  : m.isDeclined
                    ? "self-start bg-tint-very-poor border border-mark-very-poor/30 text-ink rounded-bl-none"
                    : "self-start bg-surface border border-line text-ink rounded-bl-none shadow-xs"
              }`}
            >
              <p>{m.text}</p>
            </div>
          ))
        )}

        {loading && (
          <div className="self-start flex items-center gap-2 p-2.5 rounded-panel bg-surface border border-line text-xs text-ink-muted animate-pulse">
            <span>✨</span>
            <span>{t("ui.ask.thinking", undefined, language)}</span>
          </div>
        )}
      </div>

      {/* Rate Limit Notice */}
      {rateLimitTimer !== null && (
        <p role="status" className="text-xs text-mark-moderate font-medium">
          {t("ui.status.rateLimited", { seconds: rateLimitTimer }, language)}
        </p>
      )}

      {/* Input & Character Counter Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(input);
        }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={MAX_CHARS}
            disabled={loading || rateLimitTimer !== null}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ui.ask.placeholder", undefined, language)}
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-control border border-line bg-surface text-ink focus:border-action focus-visible:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || rateLimitTimer !== null}
            className="px-4 py-2 rounded-control text-xs font-semibold bg-action text-white hover:bg-action-hover disabled:opacity-50 transition-colors"
          >
            {t("ui.ask.askButton", undefined, language)}
          </button>
        </div>

        <div className="flex justify-between items-center text-[11px] text-ink-muted px-1">
          <span>{t("ui.ask.declinationNotice", undefined, language)}</span>
          <span className={input.length >= MAX_CHARS ? "text-mark-very-poor font-bold" : ""}>
            {input.length} / {MAX_CHARS}
          </span>
        </div>
      </form>
    </section>
  );
};
