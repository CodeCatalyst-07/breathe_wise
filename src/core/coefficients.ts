/**
 * Verification status of an empirical or engineering parameter.
 */
export type CoefficientStatus = "sourced" | "assumption" | "needs-source";
export type CoefficientConfidence = "high" | "medium" | "low";

/**
 * Standard structured container for all model parameters (Honesty Rule).
 */
export interface Coefficient {
  readonly key: string;
  readonly low: number | null;
  readonly likely: number | null;
  readonly high: number | null;
  readonly unit: string;
  readonly status: CoefficientStatus;
  readonly source: string;
  readonly confidence: CoefficientConfidence;
  readonly description: string;
}

/**
 * Registry of all physical, behavioral, and standard parameters utilized in BreatheWise.
 */
export const COEFFICIENTS: Record<string, Coefficient> = {
  penetrationFactor: {
    key: "penetration_factor",
    low: 0.7,
    likely: 0.85,
    high: 1.0,
    unit: "dimensionless",
    status: "assumption",
    source: "modeller assumption - verify before citing",
    confidence: "low",
    description:
      "Indoor particulate penetration fraction (P) across building envelope cracks and infiltration pathways",
  },
  airExchangeClosed: {
    key: "air_exchange_closed",
    low: 0.3,
    likely: 0.6,
    high: 1.0,
    unit: "1/h",
    status: "assumption",
    source: "modeller assumption - verify before citing",
    confidence: "low",
    description:
      "Air exchange rate (a) with windows and exterior doors closed in typical urban residential construction",
  },
  airExchangeOpen: {
    key: "air_exchange_open",
    low: 1.5,
    likely: 3.0,
    high: 6.0,
    unit: "1/h",
    status: "assumption",
    source: "modeller assumption - verify before citing",
    confidence: "low",
    description: "Air exchange rate (a) with windows actively opened for natural cross-ventilation",
  },
  depositionRate: {
    key: "deposition_rate",
    low: 0.1,
    likely: 0.3,
    high: 0.5,
    unit: "1/h",
    status: "assumption",
    source: "modeller assumption - verify before citing",
    confidence: "low",
    description:
      "Indoor surface loss rate (k) for PM2.5 through gravitational settling and brownian diffusion",
  },
  purifierTargetACH: {
    key: "purifier_target_ach",
    low: 4.0,
    likely: 4.5,
    high: 5.0,
    unit: "1/h",
    status: "assumption",
    source: "general purifier-sizing rule of thumb",
    confidence: "low",
    description:
      "Target room air changes per hour (ACH) achieved via clean air delivery rate (CADR) for effective indoor filtration",
  },
  whoPm25Guideline24h: {
    key: "who_pm25_guideline_24h",
    low: 15.0,
    likely: 15.0,
    high: 15.0,
    unit: "ug/m3",
    status: "sourced",
    source: "WHO global air quality guidelines 2021",
    confidence: "high",
    description:
      "World Health Organization 24-hour mean guideline concentration threshold for PM2.5",
  },
  aqiTopBandConcentration: {
    key: "aqi_top_band_concentration",
    low: 380.0,
    likely: 450.0,
    high: 500.0,
    unit: "ug/m3",
    status: "assumption",
    source: "modeller assumption - verify before citing",
    confidence: "low",
    description:
      "Assumed upper concentration for CPCB linear AQI sub-index 500 ceiling extrapolation",
  },
  defaultRoomVolumeM3: {
    key: "default_room_volume_m3",
    low: 30.0,
    likely: 45.0,
    high: 70.0,
    unit: "m3",
    status: "assumption",
    source: "modeller assumption - typical urban bedroom volume",
    confidence: "low",
    description:
      "Fallback room volume estimate when user profile omits specific residential dimensions",
  },
  maskFiltrationEfficiency: {
    key: "mask_filtration_efficiency",
    low: null,
    likely: null,
    high: null,
    unit: "%",
    status: "needs-source",
    source:
      "Needs independent fit testing certification (e.g. NIOSH N95 / EN149 FFP2); not assumed in core",
    confidence: "low",
    description:
      "Effective inward leakage reduction; highly user-fit dependent, treated as directional only",
  },
  travelModeExposureRatio: {
    key: "travel_mode_exposure_ratio",
    low: null,
    likely: null,
    high: null,
    unit: "dimensionless",
    status: "needs-source",
    source: "City-specific route & microenvironment study needed; not assumed in core",
    confidence: "low",
    description: "Ratio of in-transit exposure across transit modes; treated as directional only",
  },
  cookingVentilationEffectiveness: {
    key: "cooking_ventilation_effectiveness",
    low: null,
    likely: null,
    high: null,
    unit: "%",
    status: "needs-source",
    source: "Kitchen geometry and exhaust flow rate dependent; not assumed in core",
    confidence: "low",
    description: "Exhaust capture efficiency during indoor cooking; treated as directional only",
  },
  plantAirCleaningRate: {
    key: "plant_air_cleaning_rate",
    low: null,
    likely: null,
    high: null,
    unit: "m3/h",
    status: "needs-source",
    source:
      "Peer-reviewed literature shows houseplant phytoremediation is negligible in real rooms",
    confidence: "low",
    description: "Phytoremediation PM2.5 clearance rate; evaluated as ineffective in real rooms",
  },
  biomassBurningContribution: {
    key: "biomass_burning_contribution",
    low: null,
    likely: null,
    high: null,
    unit: "ug/m3",
    status: "needs-source",
    source: "Hyperlocal source apportionment data required; not assumed in core",
    confidence: "low",
    description: "Localized PM2.5 elevation from open burning; directional only",
  },
  // TODO: Source empirical building-scale refuge room air-cleaning data
  sharedCleanAirRoomEffectiveness: {
    key: "shared_clean_air_room_effectiveness",
    low: null,
    likely: null,
    high: null,
    unit: "%",
    status: "needs-source",
    source:
      "Shared clean air room filtration efficacy depends on envelope and occupancy; needs-source",
    confidence: "low",
    description: "Efficacy of designated shared clean air refuge room; directional only",
  },
  // TODO: Source school gate microenvironment idling reduction data
  vehicleIdlingExposureReduction: {
    key: "vehicle_idling_exposure_reduction",
    low: null,
    likely: null,
    high: null,
    unit: "ug/m3",
    status: "needs-source",
    source: "School gate microenvironment idling emission study needed; needs-source",
    confidence: "low",
    description: "Localized PM2.5 reduction from vehicle anti-idling; directional only",
  },
  // TODO: Source regional fleet trip curtailment emission factors
  carpoolingTripCurtailment: {
    key: "carpooling_trip_curtailment",
    low: null,
    likely: null,
    high: null,
    unit: "%",
    status: "needs-source",
    source: "Fleet trip reduction impact depends on regional adoption; needs-source",
    confidence: "low",
    description: "Emissions reduction from ridesharing and carpooling; directional only",
  },
} as const;

export function getNonSourcedCoefficients(): Coefficient[] {
  return Object.values(COEFFICIENTS).filter((c) => c.status !== "sourced");
}

export function getAssumptions(): Coefficient[] {
  return Object.values(COEFFICIENTS).filter((c) => c.status === "assumption");
}

export function getCoefficient(key: string): Coefficient | undefined {
  return COEFFICIENTS[key];
}
