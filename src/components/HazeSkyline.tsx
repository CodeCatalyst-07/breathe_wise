"use client";

import React from "react";
import type { AqiCategoryLevel } from "@/core/types";

interface HazeSkylineProps {
  category: AqiCategoryLevel;
  className?: string;
}

const CATEGORY_OPACITY: Record<
  AqiCategoryLevel,
  { layer4: number; layer3: number; layer2: number; layer1: number }
> = {
  good: { layer4: 0.95, layer3: 1.0, layer2: 1.0, layer1: 1.0 },
  satisfactory: { layer4: 0.7, layer3: 0.95, layer2: 1.0, layer1: 1.0 },
  moderate: { layer4: 0.4, layer3: 0.8, layer2: 0.95, layer1: 1.0 },
  poor: { layer4: 0.1, layer3: 0.5, layer2: 0.85, layer1: 1.0 },
  very_poor: { layer4: 0.0, layer3: 0.2, layer2: 0.65, layer1: 1.0 },
  severe: { layer4: 0.0, layer3: 0.0, layer2: 0.25, layer1: 1.0 },
};

export const HazeSkyline: React.FC<HazeSkylineProps> = ({ category, className = "" }) => {
  const opacities = CATEGORY_OPACITY[category] ?? CATEGORY_OPACITY.moderate;

  return (
    <div
      aria-hidden="true"
      className={`relative w-full h-36 md:h-48 overflow-hidden select-none pointer-events-none transition-all duration-900 ease-out ${className}`}
    >
      <svg
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skyHazeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#F2F5F6" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <rect width="1000" height="240" fill="url(#skyHazeGrad)" />

        <g
          className="transition-opacity duration-900 ease-out"
          style={{ opacity: opacities.layer4 }}
          fill="#8A9CA6"
        >
          <path d="M 120 180 C 120 130 180 130 180 180 Z" />
          <path d="M 148 135 L 152 135 L 150 100 Z" />
          <path d="M 280 200 L 350 150 L 420 200 Z" />
          <path d="M 390 200 L 480 140 L 560 200 Z" />
          <path d="M 820 200 L 825 80 L 830 200 Z" />
          <line x1="815" y1="120" x2="835" y2="120" stroke="#8A9CA6" strokeWidth="2" />
          <line x1="818" y1="150" x2="832" y2="150" stroke="#8A9CA6" strokeWidth="2" />
        </g>

        <g
          className="transition-opacity duration-900 ease-out"
          style={{ opacity: opacities.layer3 }}
          fill="#5E7582"
        >
          <rect x="40" y="140" width="60" height="100" rx="2" />
          <rect x="220" y="120" width="80" height="120" rx="2" />
          <rect x="320" y="150" width="50" height="90" rx="2" />
          <rect x="580" y="110" width="90" height="130" rx="2" />
          <rect x="690" y="135" width="70" height="105" rx="2" />
          <rect x="880" y="125" width="85" height="115" rx="2" />
          <rect x="250" y="108" width="20" height="12" rx="1" fill="#4B616D" />
          <rect x="620" y="98" width="16" height="12" rx="1" fill="#4B616D" />
        </g>

        <g
          className="transition-opacity duration-900 ease-out"
          style={{ opacity: opacities.layer2 }}
          fill="#3B525F"
        >
          <rect x="0" y="170" width="90" height="70" rx="2" />
          <rect x="150" y="165" width="110" height="75" rx="2" />
          <rect x="430" y="160" width="130" height="80" rx="2" />
          <rect x="740" y="170" width="100" height="70" rx="2" />
          <circle cx="110" cy="185" r="24" />
          <circle cx="280" cy="180" r="28" />
          <circle cx="400" cy="185" r="22" />
          <circle cx="580" cy="180" r="26" />
          <circle cx="860" cy="185" r="25" />
          <circle cx="980" cy="180" r="30" />
        </g>

        <g
          className="transition-opacity duration-900 ease-out"
          style={{ opacity: opacities.layer1 }}
          fill="#14262F"
        >
          <rect x="0" y="215" width="1000" height="25" />
          <path
            d="M 60 215 L 62 140 C 62 130 75 130 85 133"
            stroke="#14262F"
            strokeWidth="3"
            fill="none"
          />
          <path d="M 83 133 L 88 138 L 81 140 Z" />
          <path d="M 500 215 Q 520 180 540 215 Z" />
          <path d="M 710 215 Q 730 175 750 215 Z" />
          <circle cx="20" cy="210" r="16" />
          <circle cx="950" cy="210" r="18" />
        </g>
      </svg>
    </div>
  );
};
