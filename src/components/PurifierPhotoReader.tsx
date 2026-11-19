"use client";

import React, { useRef, useState } from "react";
import type { Language } from "@/core/types";
import type { PurifierLabelResult } from "@/core/cadr";
import { t } from "@/lib/i18n";
import { downscaleImage } from "@/lib/image-downscale";

export interface PurifierPhotoReaderProps {
  language: Language;
  onApplyCadr: (cadrM3h: number) => void;
}

export function PurifierPhotoReader({ language, onApplyCadr }: PurifierPhotoReaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<PurifierLabelResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setDetected(null);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    try {
      const { base64, mimeType } = await downscaleImage(file);
      const res = await fetch("/api/read-purifier-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }

      const json = await res.json();
      const data: PurifierLabelResult = json.data ?? json;
      if (!data.cadrM3h) {
        setError(t("ui.purifierReader.error", undefined, language));
      } else {
        setDetected(data);
        setIsDialogOpen(true);
        setTimeout(() => applyButtonRef.current?.focus(), 50);
      }
    } catch {
      setError(t("ui.purifierReader.error", undefined, language));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    triggerButtonRef.current?.focus();
  };

  const handleApply = () => {
    if (detected?.cadrM3h) {
      onApplyCadr(detected.cadrM3h);
      handleCloseDialog();
    }
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleCloseDialog();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/70 p-3 text-xs">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-stone-700">
            {t("ui.purifierReader.label", undefined, language)}
          </span>
          <button
            ref={triggerButtonRef}
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[38px] items-center rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-50"
          >
            <span aria-hidden="true" className="mr-1">
              📷
            </span>
            {loading
              ? t("ui.purifierReader.reading", undefined, language)
              : t("ui.purifierReader.button", undefined, language)}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
            aria-label={t("ui.purifierReader.label", undefined, language)}
          />
        </div>

        {/* Live announcement region */}
        <div aria-live="polite" className="sr-only">
          {detected &&
            t(
              "ui.purifierReader.detected",
              {
                cadr: detected.cadrM3h ?? "",
                unit: "m³/h",
                brand: detected.brand ?? "",
                model: detected.model ?? "",
              },
              language,
            )}
        </div>

        {/* Accessible Confirmation Dialog */}
        {isDialogOpen && detected && (
          <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="purifier-dialog-title"
              onKeyDown={handleDialogKeyDown}
              className="flex w-full max-w-sm flex-col gap-3 rounded-panel border border-line bg-surface p-5 shadow-lg"
            >
              <h3 id="purifier-dialog-title" className="font-serif font-bold text-ink text-sm">
                {t("ui.purifierReader.label", undefined, language)}
              </h3>

              {previewUrl && (
                <div className="overflow-hidden rounded-control border border-line bg-paper flex items-center justify-center max-h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={t("ui.purifierReader.previewAlt", undefined, language)}
                    className="max-h-40 object-contain"
                  />
                </div>
              )}

              <p className="font-medium text-ink text-xs">
                {t(
                  "ui.purifierReader.detected",
                  {
                    cadr: detected.cadrM3h ?? "",
                    unit: "m³/h",
                    brand: detected.brand ?? "",
                    model: detected.model ?? "",
                  },
                  language,
                )}
              </p>

              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="rounded px-3 py-1.5 text-xs text-ink-muted hover:bg-paper transition"
                >
                  {t("ui.purifierReader.cancel", undefined, language)}
                </button>
                <button
                  ref={applyButtonRef}
                  type="button"
                  onClick={handleApply}
                  className="rounded bg-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-action-hover transition"
                >
                  {t("ui.purifierReader.apply", undefined, language)}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-red-700">
            {error}
          </div>
        )}

        <p className="text-[11px] text-stone-500">
          {t("ui.purifierReader.privacyNote", undefined, language)}
        </p>
      </div>
    </div>
  );
}
