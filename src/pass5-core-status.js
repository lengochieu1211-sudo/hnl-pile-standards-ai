/**
 * HNL Pile Standards AI v1.25.7
 * P1 Pass 5 Core Locked status boundary.
 *
 * Core LOCK covers deterministic structural-data ingestion and handoff only.
 * Live ETABS/SAP certification remains deferred until a real Windows/CSi session exists.
 */
export const PASS5_CORE_LOCK = Object.freeze({
  id: "p1-pass5-core",
  version: "1.25.7",
  status: "LOCKED",
  releaseType: "CORE_LOCKED_PATCH",
  productionNumeric: false,
  lockedScope: Object.freeze([
    "CANONICAL_STRUCTURAL_IMPORT_SCHEMA",
    "DCE_WORKBOOK_TABLE_ADAPTER",
    "CSI_FLAT_TABLE_ADAPTER_CONTRACT",
    "CSV_FALLBACK",
    "CANONICAL_HANDOFF_TO_PASS3_PASS4",
    "SOURCE_SPECIFIC_SIGN_CONVENTION",
    "UNIT_PROFILE_VALIDATION",
    "IMPORT_PROVENANCE_AND_JOIN_VALIDATION"
  ]),
  deferredScope: Object.freeze([
    "LIVE_ETABS_SAP_CSI_API_CERTIFICATION",
    "WINDOWS_EXCEL_COM_RUNTIME_CERTIFICATION",
    "FULL_SOURCE_INTEGRATION_RELEASE"
  ]),
  invariant: "PARSE_NORMALIZE_MAP_VALIDATE_HANDOFF_ONLY",
  forbiddenResponsibilities: Object.freeze([
    "PILE_REACTION_CALCULATION",
    "PILE_CAPACITY_CALCULATION",
    "UTILIZATION_CALCULATION",
    "GOVERNING_COMBINATION_SELECTION",
    "PILE_COUNT_SELECTION",
    "RIGID_CAP_DISTRIBUTION"
  ])
});
