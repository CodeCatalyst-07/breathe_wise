import type { AqiCategoryLevel } from "./types";

export interface RuleEntry {
  readonly actionId: string;
  readonly basePriority: number;
  readonly vulnerablePriority: number;
  readonly baseReasonKey: string;
  readonly vulnerableReasonKey: string;
}

const K = {
  g_vent: "reasons.good_air_ventilation_opportunity",
  g_rout: "reasons.good_air_routine_ventilation",
  c_rout: "reasons.routine_indoor_source_control",
  c_vuln: "reasons.vulnerable_indoor_source_prevention",
  comm: "reasons.community_clean_air_stewardship",
  myth: "reasons.educational_myth_dispelled",
  sat_mod: "reasons.satisfactory_moderate_ventilation",
  sat_time: "reasons.satisfactory_timed_ventilation",
  mod_peak: "reasons.moderate_peak_smog_protection",
  mod_infil: "reasons.vulnerable_moderate_infiltration_prevention",
  vuln_time: "reasons.vulnerable_timed_ventilation",
  out_sched: "reasons.outdoor_exposure_schedule_optimization",
  out_avoid: "reasons.vulnerable_outdoor_avoidance_peak",
  com_inhal: "reasons.commute_inhalation_reduction",
  vuln_mask: "reasons.vulnerable_protective_masking",
  tran_mit: "reasons.transit_exposure_mitigation",
  tran_prio: "reasons.vulnerable_closed_transit_priority",
  poor_seal: "reasons.poor_air_seal_residence",
  poor_env: "reasons.vulnerable_strict_envelope_sealing",
  poor_hepa: "reasons.poor_air_hepa_filtration",
  poor_mask: "reasons.poor_air_respirator_advisory",
  poor_air: "reasons.poor_air_restricted_airing",
  poor_vent: "reasons.vulnerable_restricted_ventilation",
  sev_seal: "reasons.severe_smog_seal_envelope",
  sev_hepa: "reasons.severe_smog_continuous_hepa",
  sev_mask: "reasons.severe_smog_mandatory_masking",
  sev_out: "reasons.severe_outdoor_curtailment",
  vp_hepa: "reasons.very_poor_hepa_essential",
  vp_mask: "reasons.very_poor_respirator_essential",
  vuln_hepa: "reasons.vulnerable_hepa_protection",
} as const;

function r(
  actionId: string,
  basePriority: number,
  vulnerablePriority: number,
  baseReasonKey: string,
  vulnerableReasonKey: string,
): RuleEntry {
  return { actionId, basePriority, vulnerablePriority, baseReasonKey, vulnerableReasonKey };
}

export const RULES_BY_CATEGORY: Record<AqiCategoryLevel, readonly RuleEntry[]> = {
  good: [
    r("ventilate_at_cleanest_hour", 10, 8, K.g_vent, K.g_rout),
    r("improve_cooking_ventilation", 12, 9, K.c_rout, K.c_vuln),
    r("avoid_waste_and_biomass_burning", 20, 18, K.comm, K.comm),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
  satisfactory: [
    r("ventilate_at_cleanest_hour", 8, 6, K.sat_mod, K.sat_time),
    r("improve_cooking_ventilation", 10, 8, K.c_rout, K.c_vuln),
    r("avoid_waste_and_biomass_burning", 18, 15, K.comm, K.comm),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
  moderate: [
    r("keep_windows_closed_in_peak", 5, 3, K.mod_peak, K.mod_infil),
    r("ventilate_at_cleanest_hour", 6, 4, K.sat_mod, K.vuln_time),
    r("shift_outdoor_activity_to_cleaner_hour", 7, 4, K.out_sched, K.out_avoid),
    r("wear_fitted_respirator", 8, 5, K.com_inhal, K.vuln_mask),
    r("switch_commute_mode", 9, 6, K.tran_mit, K.tran_prio),
    r("improve_cooking_ventilation", 8, 6, K.c_rout, K.c_vuln),
    r("avoid_waste_and_biomass_burning", 15, 12, K.comm, K.comm),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
  poor: [
    r("keep_windows_closed_in_peak", 3, 2, K.poor_seal, K.poor_env),
    r("use_hepa_purifier", 4, 1, K.poor_hepa, K.vuln_hepa),
    r("wear_fitted_respirator", 5, 2, K.poor_mask, K.vuln_mask),
    r("shift_outdoor_activity_to_cleaner_hour", 5, 3, K.out_sched, K.out_avoid),
    r("switch_commute_mode", 6, 4, K.tran_mit, K.tran_prio),
    r("improve_cooking_ventilation", 7, 5, K.c_rout, K.c_vuln),
    r("ventilate_at_cleanest_hour", 8, 6, K.poor_air, K.poor_vent),
    r("avoid_waste_and_biomass_burning", 12, 10, K.comm, K.comm),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
  very_poor: [
    r("keep_windows_closed_in_peak", 2, 1, K.sev_seal, K.poor_env),
    r("use_hepa_purifier", 3, 1, K.vp_hepa, K.vuln_hepa),
    r("wear_fitted_respirator", 3, 1, K.vp_mask, K.vuln_mask),
    r("shift_outdoor_activity_to_cleaner_hour", 4, 2, K.out_sched, K.out_avoid),
    r("switch_commute_mode", 5, 2, K.tran_mit, K.tran_prio),
    r("improve_cooking_ventilation", 6, 3, K.c_rout, K.c_vuln),
    r("ventilate_at_cleanest_hour", 9, 7, K.poor_air, K.poor_vent),
    r("avoid_waste_and_biomass_burning", 10, 8, K.comm, K.comm),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
  severe: [
    r("keep_windows_closed_in_peak", 1, 1, K.sev_seal, K.poor_env),
    r("use_hepa_purifier", 1, 1, K.sev_hepa, K.vuln_hepa),
    r("wear_fitted_respirator", 2, 1, K.sev_mask, K.vuln_mask),
    r("shift_outdoor_activity_to_cleaner_hour", 3, 1, K.sev_out, K.out_avoid),
    r("switch_commute_mode", 4, 1, K.tran_mit, K.tran_prio),
    r("improve_cooking_ventilation", 5, 2, K.c_rout, K.c_vuln),
    r("avoid_waste_and_biomass_burning", 8, 5, K.comm, K.comm),
    r("ventilate_at_cleanest_hour", 12, 10, K.poor_air, K.poor_vent),
    r("plants_myth_check", 25, 25, K.myth, K.myth),
  ],
};
