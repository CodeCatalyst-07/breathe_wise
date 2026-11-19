import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-surface p-8 rounded-panel border border-line shadow-sm flex flex-col items-center gap-4">
        <span className="text-4xl" role="img" aria-label="Foggy horizon">
          🌫️
        </span>
        <h1 className="text-2xl font-serif font-bold text-ink">Page Not Found</h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          The requested page could not be found. Return to BreatheWise for live urban air quality
          advisories and daily guidance.
        </p>
        <Link
          href="/"
          className="mt-2 px-5 py-2.5 rounded-control text-xs font-semibold bg-action text-white hover:bg-action-hover focus-visible:ring-2 transition-colors"
        >
          ← Return to Home
        </Link>
      </div>
    </div>
  );
}
