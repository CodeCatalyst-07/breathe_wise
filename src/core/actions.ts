import {
  evaluateHepaPurifier,
  evaluateKeepWindowsClosed,
  evaluateShiftOutdoorActivity,
  evaluateVentilateAtCleanestHour,
} from "./action-evaluators";
import type { ActionContext, ActionError } from "./action-evaluators";
import { COEFFICIENTS } from "./coefficients";
import type { Result } from "./ports";
import { ok } from "./ports";
import type { DisplayMode, HouseholdProfile, ImpactResult } from "./types";

export * from "./action-evaluators";

export interface ActionDefinition {
  readonly id: string;
  readonly labelKey: string;
  readonly group: "household" | "community";
  readonly displayMode: DisplayMode;
  appliesTo(profile: HouseholdProfile, context: ActionContext): boolean;
  evaluate(profile: HouseholdProfile, context: ActionContext): Result<ImpactResult, ActionError>;
}

export const ACTIONS: readonly ActionDefinition[] = [
  {
    id: "ventilate_at_cleanest_hour",
    labelKey: "actions.ventilate_at_cleanest_hour.label",
    group: "household",
    displayMode: "numeric",
    appliesTo: (p) => p.home.windowsHabit !== "closed_all_day",
    evaluate: evaluateVentilateAtCleanestHour,
  },
  {
    id: "keep_windows_closed_in_peak",
    labelKey: "actions.keep_windows_closed_in_peak.label",
    group: "household",
    displayMode: "numeric",
    appliesTo: () => true,
    evaluate: evaluateKeepWindowsClosed,
  },
  {
    id: "use_hepa_purifier",
    labelKey: "actions.use_hepa_purifier.label",
    group: "household",
    displayMode: "numeric",
    appliesTo: () => true,
    evaluate: evaluateHepaPurifier,
  },
  {
    id: "shift_outdoor_activity_to_cleaner_hour",
    labelKey: "actions.shift_outdoor_activity_to_cleaner_hour.label",
    group: "household",
    displayMode: "numeric",
    appliesTo: () => true,
    evaluate: evaluateShiftOutdoorActivity,
  },
  {
    id: "wear_fitted_respirator",
    labelKey: "actions.wear_fitted_respirator.label",
    group: "household",
    displayMode: "directional",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "wear_fitted_respirator",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.respirator_fit_is_critical_caveat"],
        sources: [COEFFICIENTS["maskFiltrationEfficiency"]!.source],
        confidence: "medium",
      }),
  },
  {
    id: "switch_commute_mode",
    labelKey: "actions.switch_commute_mode.label",
    group: "household",
    displayMode: "directional",
    appliesTo: (p) => ["walk", "bicycle", "two_wheeler", "auto_rickshaw"].includes(p.commuteMode),
    evaluate: () =>
      ok({
        actionId: "switch_commute_mode",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.commute_enclosed_transit_mitigation"],
        sources: [COEFFICIENTS["travelModeExposureRatio"]!.source],
        confidence: "low",
      }),
  },
  {
    id: "improve_cooking_ventilation",
    labelKey: "actions.improve_cooking_ventilation.label",
    group: "household",
    displayMode: "directional",
    appliesTo: (p) => p.home.cookingFuel !== "electric_induction",
    evaluate: () =>
      ok({
        actionId: "improve_cooking_ventilation",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.kitchen_exhaust_capture"],
        sources: [COEFFICIENTS["cookingVentilationEffectiveness"]!.source],
        confidence: "medium",
      }),
  },
  {
    id: "avoid_waste_and_biomass_burning",
    labelKey: "actions.avoid_waste_and_biomass_burning.label",
    group: "community",
    displayMode: "directional",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "avoid_waste_and_biomass_burning",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.community_emission_curtailment"],
        sources: [COEFFICIENTS["biomassBurningContribution"]!.source],
        confidence: "low",
      }),
  },
  {
    id: "shared_clean_air_room_for_building",
    labelKey: "actions.shared_clean_air_room_for_building.label",
    group: "community",
    displayMode: "directional",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "shared_clean_air_room_for_building",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.shared_clean_air_room_envelope"],
        sources: [COEFFICIENTS["sharedCleanAirRoomEffectiveness"]!.source],
        confidence: "low",
      }),
  },
  {
    id: "reduce_vehicle_idling_at_school_gates",
    labelKey: "actions.reduce_vehicle_idling_at_school_gates.label",
    group: "community",
    displayMode: "directional",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "reduce_vehicle_idling_at_school_gates",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.school_gate_idling_exposure"],
        sources: [COEFFICIENTS["vehicleIdlingExposureReduction"]!.source],
        confidence: "low",
      }),
  },
  {
    id: "organise_carpool_or_shared_transport",
    labelKey: "actions.organise_carpool_or_shared_transport.label",
    group: "community",
    displayMode: "directional",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "organise_carpool_or_shared_transport",
        displayMode: "directional",
        direction: "reduces",
        assumptions: ["assumptions.carpooling_trip_curtailment"],
        sources: [COEFFICIENTS["carpoolingTripCurtailment"]!.source],
        confidence: "low",
      }),
  },
  {
    id: "plants_myth_check",
    labelKey: "actions.plants_myth_check.label",
    group: "household",
    displayMode: "myth-check",
    appliesTo: () => true,
    evaluate: () =>
      ok({
        actionId: "plants_myth_check",
        displayMode: "myth-check",
        direction: "ineffective",
        assumptions: ["assumptions.plants_phytoremediation_negligible"],
        sources: [COEFFICIENTS["plantAirCleaningRate"]!.source],
        confidence: "high",
      }),
  },
] as const;

export function getActionById(id: string): ActionDefinition | undefined {
  return ACTIONS.find((a) => a.id === id);
}
