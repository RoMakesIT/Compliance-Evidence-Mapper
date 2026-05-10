import { Control, Evidence, EvidenceControlMapping } from "./types";
import { newId } from "./store";

const DOMAIN_BOOST_TERMS = [
  "mfa",
  "multi-factor",
  "backup",
  "vulnerability",
  "incident",
  "vendor",
  "encryption",
  "access review",
  "firewall",
  "training",
  "policy",
  "retention",
  "deletion",
  "change approval",
  "logging",
  "audit log",
  "patch",
  "least privilege",
  "onboarding",
  "offboarding",
  "background check",
  "risk assessment",
];

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function splitKeywords(s: string): string[] {
  return s
    .split(/[;,]/g)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

export interface MatchResult {
  control: Control;
  score: number;
  matchedKeywords: string[];
  rationale: string;
}

export function matchEvidence(evidence: Evidence, controls: Control[], topN = 8): MatchResult[] {
  const haystack = [evidence.title, evidence.file_name, evidence.description, evidence.extracted_text]
    .join(" ")
    .toLowerCase();
  const tokens = tokenize(haystack);

  const results: MatchResult[] = controls.map((c) => {
    const keywords = splitKeywords(c.evidence_keywords);
    const descTokens = tokenize(c.description);
    const matched: string[] = [];
    let score = 0;

    for (const kw of keywords) {
      if (kw.includes(" ")) {
        if (haystack.includes(kw)) {
          score += 3;
          matched.push(kw);
        }
      } else if (tokens.has(kw)) {
        score += 2;
        matched.push(kw);
      }
    }

    let descOverlap = 0;
    descTokens.forEach((t) => {
      if (tokens.has(t)) descOverlap += 1;
    });
    score += Math.min(descOverlap * 0.5, 5);

    for (const term of DOMAIN_BOOST_TERMS) {
      if (haystack.includes(term)) {
        const inControl =
          c.description.toLowerCase().includes(term) || c.evidence_keywords.toLowerCase().includes(term);
        if (inControl) score += 2.5;
      }
    }

    // Prefer child controls (more specific) when matched
    if (c.parent_control_code && score > 0) score += 1;

    const rationale =
      matched.length > 0
        ? `Matched keywords: ${matched.slice(0, 6).join(", ")}${descOverlap ? `; ${descOverlap} description term overlap` : ""}.`
        : descOverlap > 0
          ? `Matched ${descOverlap} description terms.`
          : "No keyword matches.";

    return { control: c, score, matchedKeywords: matched, rationale };
  });

  const filtered = results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

  // Suppress parent if a child of the same parent is already in the top set
  const childParents = new Set(filtered.filter((r) => r.control.parent_control_code).map((r) => r.control.parent_control_code));
  const deduped = filtered.filter((r) => !(childParents.has(r.control.control_code) && filtered.indexOf(r) > 0));

  return deduped.slice(0, topN);
}

export function buildMappingsFromMatches(
  evidenceId: string,
  companyId: string,
  matches: MatchResult[],
): EvidenceControlMapping[] {
  const maxScore = Math.max(...matches.map((m) => m.score), 1);
  return matches.map((m) => ({
    id: newId(),
    company_id: companyId,
    evidence_id: evidenceId,
    control_id: m.control.id,
    confidence: Math.min(0.99, Number((m.score / (maxScore * 1.1)).toFixed(2))),
    rationale: m.rationale,
    matched_keywords: m.matchedKeywords,
    mapping_status: "Suggested" as const,
    reviewer_notes: "",
    created_at: new Date().toISOString(),
  }));
}
