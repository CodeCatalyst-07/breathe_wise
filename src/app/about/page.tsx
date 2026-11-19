import React from "react";
import Link from "next/link";
import { getNonSourcedCoefficients } from "@/core/coefficients";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "How BreatheWise Works — Transparency & Methodology",
  description:
    "Scientific principles, mass-balance models, parametric assumptions, and privacy boundaries governing BreatheWise.",
};

export default function AboutPage() {
  const assumptions = getNonSourcedCoefficients();

  return (
    <div className="min-h-screen bg-paper text-ink py-10 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs font-semibold text-action hover:underline focus-visible:ring-2 rounded self-start"
          >
            {t("ui.about.backLink")}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">
            {t("ui.about.title")}
          </h1>
          <p className="text-sm sm:text-base text-ink-muted">{t("ui.about.subtitle")}</p>
        </header>

        {/* Section 1: Ground Stations & Forecasts */}
        <section className="bg-surface rounded-panel border border-line p-6 flex flex-col gap-3 shadow-sm">
          <h2 className="text-lg font-serif font-bold text-ink">{t("ui.about.section1Title")}</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{t("ui.about.section1Body")}</p>
        </section>

        {/* Section 2: Indoor Mass-Balance Physics */}
        <section className="bg-surface rounded-panel border border-line p-6 flex flex-col gap-3 shadow-sm">
          <h2 className="text-lg font-serif font-bold text-ink">{t("ui.about.section2Title")}</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{t("ui.about.section2Body")}</p>
          <div
            tabIndex={0}
            role="region"
            aria-label="Indoor mass-balance formula"
            className="p-3 bg-paper rounded-control border border-line font-mono text-xs text-ink overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          >
            C_indoor = C_outdoor × [ (P × a) / (a + k + (CADR / V)) ]
          </div>
        </section>

        {/* Section 3: Transparent Assumptions Table */}
        <section className="bg-surface rounded-panel border border-line p-6 flex flex-col gap-4 shadow-sm">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-serif font-bold text-ink">{t("ui.about.section3Title")}</h2>
            <p className="text-xs sm:text-sm text-ink-muted">{t("ui.about.section3Body")}</p>
          </header>

          <div
            tabIndex={0}
            role="region"
            aria-label="Parametric Assumptions Table"
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line text-ink-muted font-semibold bg-paper/50">
                  <th className="py-2.5 px-3">{t("ui.about.tableParam")}</th>
                  <th className="py-2.5 px-3">{t("ui.about.tableRange")}</th>
                  <th className="py-2.5 px-3">{t("ui.about.tableConfidence")}</th>
                  <th className="py-2.5 px-3">{t("ui.about.tableSource")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {assumptions.map((coeff) => {
                  const boundsText =
                    coeff.low !== null && coeff.high !== null
                      ? `${coeff.low} – ${coeff.high} ${coeff.unit}`
                      : "Directional only";
                  return (
                    <tr key={coeff.key} className="hover:bg-paper/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-ink">{coeff.key}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{boundsText}</td>
                      <td className="py-2.5 px-3 capitalize">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-chip text-[11px] font-medium ${
                            coeff.confidence === "high"
                              ? "bg-tint-good text-mark-good"
                              : coeff.confidence === "medium"
                                ? "bg-tint-moderate text-mark-moderate"
                                : "bg-tint-poor text-mark-poor"
                          }`}
                        >
                          {coeff.confidence}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted">
                        <p>{coeff.description}</p>
                        <p className="text-[11px] italic text-ink-muted/80">{coeff.source}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Privacy Boundary */}
        <section className="bg-surface rounded-panel border border-line p-6 flex flex-col gap-3 shadow-sm">
          <h2 className="text-lg font-serif font-bold text-ink">{t("ui.about.section4Title")}</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{t("ui.about.section4Body")}</p>
        </section>

        {/* Section 5: Medical Boundary */}
        <section className="bg-tint-very-poor/40 rounded-panel border border-mark-very-poor/30 p-6 flex flex-col gap-3 shadow-sm">
          <h2 className="text-lg font-serif font-bold text-mark-very-poor">
            {t("ui.about.section5Title")}
          </h2>
          <p className="text-sm text-ink leading-relaxed">{t("ui.about.section5Body")}</p>
        </section>

        <footer className="pt-4 text-center">
          <Link
            href="/"
            className="inline-flex px-6 py-2.5 rounded-control font-semibold text-xs bg-action text-white hover:bg-action-hover transition-colors"
          >
            {t("ui.about.backLink")}
          </Link>
        </footer>
      </div>
    </div>
  );
}
