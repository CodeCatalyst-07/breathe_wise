"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error caught:", error.name, error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-stone-100 p-4 text-center text-stone-900 font-sans">
        <div className="max-w-md rounded-2xl border border-stone-300 bg-white p-8 shadow-md">
          <span aria-hidden="true" className="text-4xl">
            🚨
          </span>
          <h1 className="mt-4 text-2xl font-bold">Application Error</h1>
          <p className="mt-2 text-sm text-stone-600">
            A critical error occurred while rendering the page. Please reload or try again.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              Reload application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
