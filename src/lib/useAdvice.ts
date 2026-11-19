"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { AdviceResponse } from "@/core/response";
import type { HouseholdProfile } from "@/core/types";
import { fetchAdvice, fetchExplain, ApiClientError } from "./api-client";

export interface UseAdviceResult {
  advice: AdviceResponse | null;
  loading: boolean;
  error: string | null;
  isUpgradingAi: boolean;
  retryAfter: number | null;
  refetch: () => void;
}

export function useAdvice(profile: HouseholdProfile): UseAdviceResult {
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgradingAi, setIsUpgradingAi] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear countdown interval
  const clearCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadAdvice = useCallback(async () => {
    // Cancel in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    clearCountdown();

    try {
      // 1. Fast-path: immediate advice calculation
      const fastAdvice = await fetchAdvice(profile, controller.signal);
      setAdvice(fastAdvice);
      setLoading(false);

      // 2. Async tier: upgrade explanations via Gemma 4 31B IT
      setIsUpgradingAi(true);
      try {
        const upgradedAdvice = await fetchExplain(profile, controller.signal);
        setAdvice(upgradedAdvice);
      } catch (explainErr) {
        // Silent fallback: keep built-in explanation
        if ((explainErr as Error).name !== "AbortError") {
          // Keep existing fastAdvice with builtin explanations intact
        }
      } finally {
        setIsUpgradingAi(false);
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      setLoading(false);
      setIsUpgradingAi(false);

      if (err instanceof ApiClientError && err.httpStatus === 429) {
        const secs = err.retryAfterSeconds ?? 30;
        setRetryAfter(secs);
        setError("Rate limit reached. Please wait a moment.");

        timerRef.current = setInterval(() => {
          setRetryAfter((prev) => {
            if (prev === null || prev <= 1) {
              clearCountdown();
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(err instanceof Error ? err.message : "Failed to retrieve air quality advice.");
      }
    }
  }, [profile, clearCountdown]);

  useEffect(() => {
    loadAdvice();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearCountdown();
    };
  }, [loadAdvice, clearCountdown]);

  return {
    advice,
    loading,
    error,
    isUpgradingAi,
    retryAfter,
    refetch: loadAdvice,
  };
}
