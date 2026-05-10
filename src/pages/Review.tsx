import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore, newId } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Plus, Trash2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { matchEvidence, buildMappingsFromMatches } from "@/lib/matching";
import { toast } from "@/hooks/use-toast";
import { downloadCSV } from "@/lib/csv";
import { MappingStatus } from "@/lib/types";

const STATUSES: MappingStatus[] = ["Suggested", "Approved", "Rejected", "Manual", "Needs Review"];

export default function Review() {
  const {
    activeCompanyId,
    companies,
    evidence,
    controls,
    mappings,
    addMappings,
    updateMapping,
    deleteMapping,
  } = useStore();
  const company = companies.find((c) => c.id === activeCompanyId);
  const myEvidence = useMemo(
    () => evidence.filter((e) => e.company_id === activeCompanyId),
    [evidence, activeCompanyId],
  );
  const [selectedId, setSelectedId] = useState<string>(myEvidence[0]?.id || "");
  const selected = myEvidence.find((e) => e.id === selectedId) || myEvidence[0];
  const [addControl, setAddControl] = useState<string>("");

  if (!company) {
    return (
      <Layout>
        <PageHeader title="Evidence Review" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select an active company first. <Link to="/companies" className="text-primary underline">Manage companies</Link>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const myMappings = selected ? mappings.filter((m) => m.evidence_id === selected.id) : [];

  function suggest() {
    if (!selected) return;
    const matches = matchEvidence(selected, controls);
    const existing = new Set(myMappings.map((m) => m.control_id));
    const fresh = matches.filter((m) => !existing.has(m.control.id));
    if (fresh.length === 0) {
      toast({ title: "No new suggestions" });
      return;
    }
    addMappings(buildMappingsFromMatches(selected.id, company!.id, fresh));
    toast({ title: `${fresh.length} new suggestions added` });
  }

  function addManual() {
    if (!selected || !addControl) return;
    const c = controls.find((x) => x.id === addControl);
    if (!c) return;
    addMappings([
      {
        id: newId(),
        company_id: company!.id,
        evidence_id: selected.id,
        control_id: c.id,
        confidence: 1,
        rationale: "Manually added by reviewer.",
        matched_keywords: [],
        mapping_status: "Manual",
        reviewer_notes: "",
        created_at: new Date().toISOString(),
      },
    ]);
    setAddControl("");
  }

  function exportMatrix() {
    const rows = mappings
      .filter((m) => m.company_id === company!.id)
      .map((m) => {
        const ev = evidence.find((e) => e.id === m.evidence_id);
        const c = controls.find((x) => x.id === m.control_id);
        return {
          Company: company!.name,
          "Evidence Title": ev?.title || "",
          "Evidence File Name": ev?.file_name || "",
          "Control Code": c?.control_code || "",
          "Parent Control Code": c?.parent_control_code || "",
          Domain: c?.domain || "",
          "Control Description": c?.description || "",
          "SOC 2 Effective Mapping": c?.soc2_effective_mapping || "",
          "Mapping Status": m.mapping_status,
          Confidence: m.confidence,
          Rationale: m.rationale,
          "Reviewer Notes": m.reviewer_notes,
          Recommendation: c?.recommendation_template || "",
        };
      });
    downloadCSV(`${company!.name}-evidence-matrix.csv`, rows);
  }

  return (
    <Layout>
      <PageHeader
        title="Evidence Review"
        description={`Workspace: ${company.name}`}
        actions={
          <Button size="sm" onClick={exportMatrix}>
            Export Matrix
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardContent className="p-2 max-h-[70vh] overflow-auto">
            {myEvidence.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 text-center">No evidence yet.</div>
            )}
            {myEvidence.map((e) => {
              const count = mappings.filter((m) => m.evidence_id === e.id).length;
              const pending = mappings.filter(
                (m) => m.evidence_id === e.id && (m.mapping_status === "Suggested" || m.mapping_status === "Needs Review"),
              ).length;
              const active = e.id === selected?.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left rounded-md p-2.5 mb-1 text-sm transition-colors ${
                    active ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="flex gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px]">{count} mapped</Badge>
                    {pending > 0 && <Badge className="text-[10px]">{pending} pending</Badge>}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold">{selected.title}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selected.file_name || "no file"} · {new Date(selected.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={suggest}>
                    <Sparkles className="h-4 w-4" /> Re-suggest
                  </Button>
                </div>
                {selected.description && <p className="text-sm mb-2">{selected.description}</p>}
                {selected.extracted_text && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Show extracted text</summary>
                    <pre className="mt-2 whitespace-pre-wrap bg-muted p-2 rounded max-h-48 overflow-auto">
                      {selected.extracted_text}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium text-sm flex-1">Suggested & mapped controls ({myMappings.length})</h3>
                  <Select value={addControl} onValueChange={setAddControl}>
                    <SelectTrigger className="w-72 h-8 text-xs">
                      <SelectValue placeholder="Add manual mapping…" />
                    </SelectTrigger>
                    <SelectContent>
                      {controls.slice(0, 200).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs">{c.control_code}</span> — {c.description.slice(0, 60)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addManual} disabled={!addControl}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>

                {myMappings.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    No mappings yet. Click "Re-suggest" or add manually.
                  </div>
                )}

                <div className="space-y-3">
                  {myMappings
                    .slice()
                    .sort((a, b) => b.confidence - a.confidence)
                    .map((m) => {
                      const c = controls.find((x) => x.id === m.control_id);
                      if (!c) return null;
                      const parent = c.parent_control_code
                        ? controls.find((x) => x.control_code === c.parent_control_code)
                        : null;
                      return (
                        <div key={m.id} className="border rounded-md p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold">{c.control_code}</span>
                                <Badge variant="outline" className="text-[10px]">{c.domain}</Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                  {Math.round(m.confidence * 100)}% confidence
                                </Badge>
                                {parent && (
                                  <span className="text-[11px] text-muted-foreground">
                                    parent: <span className="font-mono">{parent.control_code}</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-sm mt-1.5">{c.description}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-[10px] text-muted-foreground mr-1">SOC 2:</span>
                                {c.soc2_effective_mapping
                                  .split(/[,;]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .map((s) => {
                                    const isDirect = c.soc2_direct_mapping.includes(s);
                                    return (
                                      <Badge
                                        key={s}
                                        variant={isDirect ? "secondary" : "outline"}
                                        className="text-[10px]"
                                        title={isDirect ? "Direct" : "Inherited from parent"}
                                      >
                                        {s} {!isDirect && "(inh.)"}
                                      </Badge>
                                    );
                                  })}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                <span className="font-medium">Rationale:</span> {m.rationale}
                              </div>
                              {m.matched_keywords.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Keywords:</span> {m.matched_keywords.join(", ")}
                                </div>
                              )}
                              <Textarea
                                placeholder="Reviewer notes…"
                                value={m.reviewer_notes}
                                onChange={(ev) => updateMapping(m.id, { reviewer_notes: ev.target.value })}
                                className="mt-2 text-xs min-h-[50px]"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5 items-end">
                              <Select
                                value={m.mapping_status}
                                onValueChange={(v) => updateMapping(m.id, { mapping_status: v as MappingStatus })}
                              >
                                <SelectTrigger className="h-7 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => updateMapping(m.id, { mapping_status: "Approved" })}
                                  title="Approve"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => updateMapping(m.id, { mapping_status: "Rejected" })}
                                  title="Reject"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => deleteMapping(m.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No evidence selected. <Link to="/evidence" className="text-primary underline">Upload evidence</Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
