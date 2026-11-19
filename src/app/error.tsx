"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log high-level error digest without leaking raw sensitive parameters
    console.error("Client error boundary caught exception:", error.name, error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <span aria-hidden="true" className="text-4xl">
          ⚠️
        </span>
        <h1 className="mt-4 font-serif text-2xl font-bold text-stone-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-stone-600">
          BreatheWise encountered an unexpected interface error. Your session profile details remain
          safely stored in your browser.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
