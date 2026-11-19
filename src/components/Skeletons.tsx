"use client";

import React from "react";

export const AdviceSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading air quality data and recommendations"
      className="flex flex-col gap-6 w-full animate-pulse"
    >
      {/* Hero Skeleton */}
      <div className="w-full h-72 rounded-panel bg-line/40 p-6 flex flex-col justify-between">
        <div className="flex flex-col gap-2">
          <div className="w-32 h-4 bg-line/70 rounded-control" />
          <div className="w-64 h-8 bg-line/70 rounded-control" />
        </div>
        <div className="w-48 h-16 bg-line/70 rounded-control" />
        <div className="w-full h-4 bg-line/70 rounded-control" />
      </div>

      {/* Outlook Skeleton */}
      <div className="w-full h-44 rounded-panel bg-line/40 p-6 flex flex-col gap-3">
        <div className="w-40 h-5 bg-line/70 rounded-control" />
        <div className="w-full h-12 bg-line/70 rounded-control" />
      </div>

      {/* Actions Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="w-48 h-6 bg-line/70 rounded-control" />
        <div className="w-full h-48 rounded-panel bg-line/40 p-6 flex flex-col gap-3">
          <div className="w-36 h-5 bg-line/70 rounded-control" />
          <div className="w-full h-10 bg-line/70 rounded-control" />
          <div className="w-3/4 h-8 bg-line/70 rounded-control" />
        </div>
      </div>
    </div>
  );
};
