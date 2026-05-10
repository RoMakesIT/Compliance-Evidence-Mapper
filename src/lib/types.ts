export interface Control {
  id: string;
  control_code: string;
  parent_control_code: string;
  domain: string;
  control_type: string;
  description: string;
  soc2_direct_mapping: string;
  soc2_inherited_mapping: string;
  soc2_effective_mapping: string;
  cis_ig1_mapping: string;
  suggested_evidence_examples: string;
  evidence_keywords: string;
  recommendation_template: string;
  source: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  notes: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  company_id: string;
  title: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
  description: string;
  extracted_text: string;
  notes: string;
}

export type MappingStatus = "Suggested" | "Approved" | "Rejected" | "Manual" | "Needs Review";

export interface EvidenceControlMapping {
  id: string;
  company_id: string;
  evidence_id: string;
  control_id: string;
  confidence: number;
  rationale: string;
  matched_keywords: string[];
  mapping_status: MappingStatus;
  reviewer_notes: string;
  created_at: string;
}

export type RecommendationStatus = "Draft" | "Reviewed" | "Included in Report" | "Deferred";

export interface Recommendation {
  id: string;
  company_id: string;
  control_id: string;
  recommendation_text: string;
  priority: "Low" | "Medium" | "High";
  status: RecommendationStatus;
  notes: string;
}

export type CrosswalkStatus = "Not Started" | "Suggested" | "Reviewed" | "Confirmed" | "Rejected";

export interface ControlMapCrosswalk {
  id: string;
  control_id: string;
  controlmap_control_name: string;
  controlmap_notes: string;
  confidence: number;
  review_status: CrosswalkStatus;
}

export interface LLMSettings {
  mode: "Off" | "Local Ollama" | "Cloud API";
  ollama_endpoint: string;
  model_name: string;
  temperature: number;
}
