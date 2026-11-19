"use client";

import { useEffect, useState, useRef } from "react";
import { fetchGeocode, type GeocodeCandidate } from "./api-client";
import type { Language } from "@/core/types";

export function useGeocode(query: string, lang?: Language) {
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCandidates([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const results = await fetchGeocode(trimmed, lang, controller.signal);
        setCandidates(results);
        setLoading(false);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setError("Failed to search locations");
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, lang]);

  return { candidates, loading, error };
}
