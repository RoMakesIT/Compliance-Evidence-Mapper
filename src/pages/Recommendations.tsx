import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Wand2, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/lib/active-company";
import { downloadCSV } from "@/lib/csv";
import { SourceFilterChips } from "@/components/SourceFilterChips";
import type { Tables, Enums } from "@/integrations/supabase/types";

type RecRow = Tables<"recommendations"> & {
  control: {
    control_ref: string;
    description: string | null;
    domain: string | null;
    source_hints: string[] | null;
  } | null;
};

const SEVERITIES: Enums<"recommendation_severity">[] = ["low", "med", "high", "critical"];
const STATUSES: Enums<"recommendation_status">[] = ["open", "in_progress", "resolved", "dismissed"];

async function fetchRecommendations(companyId: string): Promise<RecRow[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*, control:controls(control_ref, description, domain, source_hints)")
    .eq("company_id", companyId)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RecRow[];
}

export default function Recommendations() {
  const { activeCompany } = useActiveCompany();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | Enums<"recommendation_status">>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Enums<"recommendation_severity">>("all");
  const [search, setSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const recsQuery = useQuery({
    queryKey: ["recommendations", activeCompany?.id],
    queryFn: () => fetchRecommendations(activeCompany!.id),
    enabled: !!activeCompany,
  });

  const updateRec = useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Pick<Tables<"recommendations">, "summary" | "details" | "severity" | "status">>;
    }) => {
      const { error } = await supabase.from("recommendations").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations", activeCompany?.id] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteRec = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recommendations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations", activeCompany?.id] }),
  });

  const draftFromGaps = useMutation({
    mutationFn: async () => {
      if (!activeCompany) throw new Error("No active company");
      // Pull every Secureframe control + the active company's tagged controls.
      const { data: fw } = await supabase.from("frameworks").select("id").eq("slug", "secureframe").single();
      if (!fw) throw new Error("Secureframe framework not found");
      const { data: controls, error: cErr } = await supabase
        .from("controls")
        .select("id, control_ref, recommendation_template, parent_control_id")
        .eq("framework_id", fw.id);
      if (cErr) throw cErr;

      const { data: companyControls } = await supabase
        .from("company_controls")
        .select("control_id, evidence_controls(evidence_id)")
        .eq("company_id", activeCompany.id);
      const taggedControlIds = new Set(
        (companyControls ?? [])
          .filter((cc) => (cc.evidence_controls?.length ?? 0) > 0)
          .map((cc) => cc.control_id),
      );

      const { data: existing } = await supabase
        .from("recommendations")
        .select("control_id")
        .eq("company_id", activeCompany.id);
      const existingControlIds = new Set((existing ?? []).map((r) => r.control_id).filter(Boolean));

      const toInsert: Array<{
        company_id: string;
        control_id: string;
        summary: string;
        severity: Enums<"recommendation_severity">;
        status: Enums<"recommendation_status">;
      }> = [];
      for (const c of controls ?? []) {
        if (taggedControlIds.has(c.id)) continue;
        if (existingControlIds.has(c.id)) continue;
        if (!c.recommendation_template) continue;
        toInsert.push({
          company_id: activeCompany.id,
          control_id: c.id,
          summary: c.recommendation_template,
          severity: c.parent_control_id ? "med" : "high",
          status: "open",
        });
      }
      if (toInsert.length === 0) return 0;
      // Insert in chunks to stay under PostgREST batch limits.
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error } = await supabase.from("recommendations").insert(chunk);
        if (error) throw error;
      }
      return toInsert.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["recommendations", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats", activeCompany?.id] });
      toast({ title: `Drafted ${count} recommendations from gaps` });
    },
    onError: (e: Error) => toast({ title: "Could not draft", description: e.message, variant: "destructive" }),
  });

  const recs = recsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (selectedSources.size > 0) {
        const hits = r.control?.source_hints ?? [];
        if (!hits.some((h) => selectedSources.has(h))) return false;
      }
      if (!q) return true;
      const blob = `${r.control?.control_ref ?? ""} ${r.control?.domain ?? ""} ${r.control?.description ?? ""} ${r.summary} ${r.details ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [recs, statusFilter, severityFilter, search, selectedSources]);

  function exportCSV() {
    if (!activeCompany) return;
    const rows = filtered.map((r) => ({
      Company: activeCompany.name,
      "Control Ref": r.control?.control_ref ?? "",
      Domain: r.control?.domain ?? "",
      Summary: r.summary,
      Details: r.details ?? "",
      Severity: r.severity,
      Status: r.status,
      Created: r.created_at,
    }));
    downloadCSV(`${activeCompany.name}-recommendations.csv`, rows);
  }

  if (!activeCompany) {
    return (
      <Layout>
        <PageHeader title="Recommendations" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active company. Pick one in the sidebar, or{" "}
            <Link to="/companies" className="text-primary underline">create a company</Link>.
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Recommendations"
        description={`Workspace: ${activeCompany.name}`}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => draftFromGaps.mutate()}
              disabled={draftFromGaps.isPending}
            >
              <Wand2 className="h-4 w-4" /> {draftFromGaps.isPending ? "Working…" : "Draft from Gaps"}
            </Button>
            <Button size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      <Card className="mb-3">
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search control, domain, summary, details…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm h-8"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as typeof severityFilter)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {recs.length}
            </span>
          </div>
          <SourceFilterChips
            selected={selectedSources}
            onToggle={(v) => {
              setSelectedSources((prev) => {
                const next = new Set(prev);
                if (next.has(v)) next.delete(v);
                else next.add(v);
                return next;
              });
            }}
            onClear={() => setSelectedSources(new Set())}
          />
        </CardContent>
      </Card>

      {recsQuery.isError && (
        <Card className="mb-3">
          <CardContent className="py-4 text-sm text-destructive">
            Failed to load recommendations: {(recsQuery.error as Error).message}
          </CardContent>
        </Card>
      )}

      {!recsQuery.isLoading && recs.length === 0 && (
        <Card className="mb-3">
          <CardContent className="py-10 text-center space-y-3">
            <div className="text-sm text-muted-foreground">
              No recommendations yet for {activeCompany.name}.
            </div>
            <Button
              onClick={() => draftFromGaps.mutate()}
              disabled={draftFromGaps.isPending}
            >
              <Wand2 className="h-4 w-4" />{" "}
              {draftFromGaps.isPending ? "Drafting…" : "Draft from Gaps"}
            </Button>
            <div className="text-xs text-muted-foreground max-w-md mx-auto">
              Walks every Secureframe control without any tagged evidence and
              seeds a recommendation row from the control's recommendation
              template.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Control</TableHead>
              <TableHead className="w-32">Domain</TableHead>
              <TableHead className="w-44">Source</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead className="w-28">Severity</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recsQuery.isLoading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {recs.length === 0
                    ? "Run \"Draft from Gaps\" above to seed recommendations."
                    : "No recommendations match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs align-top pt-3">
                    {r.control?.control_ref ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs align-top pt-3">
                    {r.control?.domain && <Badge variant="outline" className="text-[10px]">{r.control.domain}</Badge>}
                  </TableCell>
                  <TableCell className="align-top pt-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.control?.source_hints ?? []).map((h) => (
                        <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>
                      ))}
                      {(r.control?.source_hints ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      defaultValue={r.summary}
                      onBlur={(e) => {
                        if (e.target.value !== r.summary) {
                          updateRec.mutate({ id: r.id, patch: { summary: e.target.value } });
                        }
                      }}
                      className="text-xs min-h-[60px]"
                    />
                    <Textarea
                      defaultValue={r.details ?? ""}
                      onBlur={(e) => {
                        if ((e.target.value || null) !== (r.details ?? null)) {
                          updateRec.mutate({ id: r.id, patch: { details: e.target.value || null } });
                        }
                      }}
                      placeholder="Notes / details…"
                      className="text-xs min-h-[40px] mt-1"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.severity}
                      onValueChange={(v) =>
                        updateRec.mutate({ id: r.id, patch: { severity: v as Enums<"recommendation_severity"> } })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        updateRec.mutate({ id: r.id, patch: { status: v as Enums<"recommendation_status"> } })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => deleteRec.mutate(r.id)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </Layout>
  );
}
