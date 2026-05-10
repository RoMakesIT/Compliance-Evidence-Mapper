// Curated taxonomy of where evidence typically comes from for our clients.
// Stored as plain text in `controls.source_hints` (array) and
// `evidence.source_system` (single value), so this list can be edited
// freely without a schema change. Existing rows remain valid even if a
// label is renamed; just update the strings.
export const SOURCE_SYSTEMS = [
  "M365",
  "Azure",
  "Intune",
  "Entra ID",
  "KnowBe4",
  "Access Reviews",
  "Policy Doc",
  "Upload",
] as const;

export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];
