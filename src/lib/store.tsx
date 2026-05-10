import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import Papa from "papaparse";
import {
  Company,
  Control,
  Evidence,
  EvidenceControlMapping,
  Recommendation,
  ControlMapCrosswalk,
  LLMSettings,
} from "./types";

const KEYS = {
  companies: "ecm.companies",
  activeCompany: "ecm.activeCompany",
  controls: "ecm.controls",
  evidence: "ecm.evidence",
  mappings: "ecm.mappings",
  recommendations: "ecm.recommendations",
  crosswalks: "ecm.crosswalks",
  llm: "ecm.llm",
};

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface StoreCtx {
  companies: Company[];
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  addCompany: (c: Omit<Company, "id" | "created_at">) => Company;
  deleteCompany: (id: string) => void;

  controls: Control[];
  importControls: () => Promise<number>;
  controlsLoaded: boolean;

  evidence: Evidence[];
  addEvidence: (e: Omit<Evidence, "id" | "uploaded_at">) => Evidence;
  deleteEvidence: (id: string) => void;

  mappings: EvidenceControlMapping[];
  addMappings: (ms: EvidenceControlMapping[]) => void;
  updateMapping: (id: string, patch: Partial<EvidenceControlMapping>) => void;
  deleteMapping: (id: string) => void;

  recommendations: Recommendation[];
  addRecommendation: (r: Omit<Recommendation, "id">) => Recommendation;
  updateRecommendation: (id: string, patch: Partial<Recommendation>) => void;
  deleteRecommendation: (id: string) => void;

  crosswalks: ControlMapCrosswalk[];
  upsertCrosswalk: (c: ControlMapCrosswalk) => void;
  deleteCrosswalk: (id: string) => void;

  llm: LLMSettings;
  setLLM: (s: LLMSettings) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(() => load(KEYS.companies, []));
  const [activeCompanyId, _setActive] = useState<string | null>(() => load<string | null>(KEYS.activeCompany, null));
  const [controls, setControls] = useState<Control[]>(() => load(KEYS.controls, []));
  const [evidence, setEvidence] = useState<Evidence[]>(() => load(KEYS.evidence, []));
  const [mappings, setMappings] = useState<EvidenceControlMapping[]>(() => load(KEYS.mappings, []));
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => load(KEYS.recommendations, []));
  const [crosswalks, setCrosswalks] = useState<ControlMapCrosswalk[]>(() => load(KEYS.crosswalks, []));
  const [llm, _setLLM] = useState<LLMSettings>(() =>
    load<LLMSettings>(KEYS.llm, {
      mode: "Off",
      ollama_endpoint: "http://localhost:11434",
      model_name: "llama3.1:8b",
      temperature: 0.1,
    }),
  );

  useEffect(() => save(KEYS.companies, companies), [companies]);
  useEffect(() => save(KEYS.activeCompany, activeCompanyId), [activeCompanyId]);
  useEffect(() => save(KEYS.controls, controls), [controls]);
  useEffect(() => save(KEYS.evidence, evidence), [evidence]);
  useEffect(() => save(KEYS.mappings, mappings), [mappings]);
  useEffect(() => save(KEYS.recommendations, recommendations), [recommendations]);
  useEffect(() => save(KEYS.crosswalks, crosswalks), [crosswalks]);
  useEffect(() => save(KEYS.llm, llm), [llm]);

  // Auto-import controls on first load
  useEffect(() => {
    if (controls.length === 0) {
      void importControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveCompanyId = (id: string | null) => _setActive(id);

  const addCompany: StoreCtx["addCompany"] = (c) => {
    const company: Company = { ...c, id: uid(), created_at: new Date().toISOString() };
    setCompanies((p) => [...p, company]);
    if (!activeCompanyId) _setActive(company.id);
    return company;
  };
  const deleteCompany = (id: string) => {
    setCompanies((p) => p.filter((c) => c.id !== id));
    setEvidence((p) => p.filter((e) => e.company_id !== id));
    setMappings((p) => p.filter((m) => m.company_id !== id));
    setRecommendations((p) => p.filter((r) => r.company_id !== id));
    if (activeCompanyId === id) _setActive(null);
  };

  const importControls = useCallback(async () => {
    const res = await fetch("/seed/controls.csv");
    const text = await res.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const rows: Control[] = parsed.data
      .filter((r) => r["Control Code"])
      .map((r) => {
        const direct = (r["SOC 2 Direct Mapping"] || "").trim();
        const inherited = (r["SOC 2 Inherited Mapping"] || "").trim();
        const effective = (r["SOC 2 Effective Mapping"] || "").trim() || direct || inherited;
        return {
          id: r["Control Code"],
          control_code: r["Control Code"],
          parent_control_code: r["Parent Control Code"] || "",
          domain: r["Domain"] || "",
          control_type: r["Control Type"] || "",
          description: r["Description"] || "",
          soc2_direct_mapping: direct,
          soc2_inherited_mapping: inherited,
          soc2_effective_mapping: effective,
          cis_ig1_mapping: r["CIS IG1 Mapping"] || "",
          suggested_evidence_examples: r["Suggested Evidence Examples"] || "",
          evidence_keywords: r["Evidence Keywords"] || "",
          recommendation_template: r["Recommendation Template"] || "",
          source: r["Source"] || "",
        };
      });
    setControls(rows);
    return rows.length;
  }, []);

  const addEvidence: StoreCtx["addEvidence"] = (e) => {
    const ev: Evidence = { ...e, id: uid(), uploaded_at: new Date().toISOString() };
    setEvidence((p) => [...p, ev]);
    return ev;
  };
  const deleteEvidence = (id: string) => {
    setEvidence((p) => p.filter((e) => e.id !== id));
    setMappings((p) => p.filter((m) => m.evidence_id !== id));
  };

  const addMappings = (ms: EvidenceControlMapping[]) => setMappings((p) => [...p, ...ms]);
  const updateMapping: StoreCtx["updateMapping"] = (id, patch) =>
    setMappings((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const deleteMapping = (id: string) => setMappings((p) => p.filter((m) => m.id !== id));

  const addRecommendation: StoreCtx["addRecommendation"] = (r) => {
    const rec: Recommendation = { ...r, id: uid() };
    setRecommendations((p) => [...p, rec]);
    return rec;
  };
  const updateRecommendation: StoreCtx["updateRecommendation"] = (id, patch) =>
    setRecommendations((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRecommendation = (id: string) => setRecommendations((p) => p.filter((r) => r.id !== id));

  const upsertCrosswalk = (c: ControlMapCrosswalk) =>
    setCrosswalks((p) => {
      const i = p.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        const n = [...p];
        n[i] = c;
        return n;
      }
      return [...p, c];
    });
  const deleteCrosswalk = (id: string) => setCrosswalks((p) => p.filter((c) => c.id !== id));

  const setLLM = (s: LLMSettings) => _setLLM(s);

  return (
    <Ctx.Provider
      value={{
        companies,
        activeCompanyId,
        setActiveCompanyId,
        addCompany,
        deleteCompany,
        controls,
        controlsLoaded: controls.length > 0,
        importControls,
        evidence,
        addEvidence,
        deleteEvidence,
        mappings,
        addMappings,
        updateMapping,
        deleteMapping,
        recommendations,
        addRecommendation,
        updateRecommendation,
        deleteRecommendation,
        crosswalks,
        upsertCrosswalk,
        deleteCrosswalk,
        llm,
        setLLM,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export const newId = uid;
