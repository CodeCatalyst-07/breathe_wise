"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import type { Location, Language } from "@/core/types";
import { useGeocode } from "@/lib/useGeocode";
import type { GeocodeCandidate } from "@/lib/api-client";
import { t } from "@/lib/i18n";

interface LocationPickerProps {
  currentLocation: Location;
  onSelectLocation: (loc: Location) => void;
  language?: Language;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  currentLocation,
  onSelectLocation,
  language = "en",
}) => {
  const [query, setQuery] = useState(currentLocation.label);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const comboboxId = useId();

  const { candidates, loading } = useGeocode(query);

  // Sync query when currentLocation prop changes
  useEffect(() => {
    setQuery(currentLocation.label);
  }, [currentLocation.label]);

  const handleSelect = (candidate: GeocodeCandidate) => {
    onSelectLocation({
      lat: candidate.lat,
      lng: candidate.lng,
      label: candidate.label,
      timezone: candidate.timezone || "Asia/Kolkata",
    });
    setQuery(candidate.label);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || candidates.length === 0) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : candidates.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < candidates.length) {
        const cand = candidates[activeIndex];
        if (cand) handleSelect(cand);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus(t("ui.location.geoUnavailable", undefined, language));
      return;
    }

    setGeoStatus(t("ui.location.searching", undefined, language));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onSelectLocation({
          lat: Number(latitude.toFixed(4)),
          lng: Number(longitude.toFixed(4)),
          label: `GPS (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
          timezone: "Asia/Kolkata",
        });
        setQuery(`GPS (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`);
        setGeoStatus(null);
        setIsOpen(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus(t("ui.location.geoPermissionDenied", undefined, language));
        } else {
          setGeoStatus(t("ui.location.geoUnavailable", undefined, language));
        }
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  return (
    <div className="relative w-full flex flex-col gap-2">
      <label
        htmlFor={comboboxId}
        className="text-xs sm:text-sm font-semibold text-ink flex items-center justify-between"
      >
        <span>📍 {t("ui.location.label", undefined, language)}</span>
        {loading && (
          <span className="text-[11px] font-normal text-action animate-pulse">
            {t("ui.location.searching", undefined, language)}
          </span>
        )}
      </label>

      {/* ARIA 1.2 Combobox Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={comboboxId}
          type="text"
          role="combobox"
          aria-expanded={isOpen && candidates.length > 0}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (candidates.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay closing slightly so item click registers
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("ui.location.placeholder", undefined, language)}
          className="w-full px-3.5 py-2.5 rounded-control border border-line bg-surface text-ink text-sm shadow-sm focus:border-action focus-visible:outline-none"
        />

        {query.length > 0 && (
          <button
            type="button"
            aria-label="Clear location search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown Candidate Listbox */}
      {isOpen && candidates.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("ui.location.label", undefined, language)}
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-control bg-surface border border-line shadow-lg py-1 text-sm"
        >
          {candidates.map((cand, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <li
                key={`${cand.lat}-${cand.lng}-${idx}`}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={() => handleSelect(cand)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`px-3.5 py-2 cursor-pointer transition-colors ${
                  isSelected ? "bg-action text-white" : "text-ink hover:bg-paper"
                }`}
              >
                <p className="font-semibold">{cand.label}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Current Location Trigger with Privacy Notice */}
      <div className="flex flex-col gap-1 pt-1">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-action hover:underline focus-visible:ring-2 rounded self-start"
        >
          <span>🎯</span>
          <span>{t("ui.location.useCurrent", undefined, language)}</span>
        </button>
        <p className="text-[11px] text-ink-muted">
          {t("ui.location.currentLocationPrivacyNote", undefined, language)}
        </p>
        {geoStatus && (
          <p role="status" className="text-xs text-mark-moderate font-medium">
            {geoStatus}
          </p>
        )}
      </div>
    </div>
  );
};
