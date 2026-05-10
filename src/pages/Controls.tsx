import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/lib/active-company";
import { ControlSheet } from "@/components/ControlSheet";
import { SourceFilterChips } from "@/components/SourceFilterChips";
import type { Tables } from "@/integrations/supabase/types";

type ControlRow = Tables<"controls">;

type CrosswalkRow = {
  source_control_id: string;
  target_control_id: string;
  mapping_type: string;
  target: { control_ref: string; framework_id: string } | null;
};

type EvidenceCountRow = { control_id: string; count: number };

const SECUREFRAME_SLUG = "secureframe";

async function fetchSecureframeFrameworkId(): Promise<string> {
  const { data, error } = await supabase
    .from("frameworks")
    .select("id")
    .eq("slug", SECUREFRAME_SLUG)
    .single();
  if (error) throw error;
  return data.id;
}

async function fetchSecureframeControls(): Promise<ControlRow[]> {
  const fwId = await fetchSecureframeFrameworkId();
  const { data, error } = await supabase
    .from("controls")
    .select("*")
    .eq("framework_id", fwId)
    .order("control_ref");
  if (error) throw error;
  return data ?? [];
}

async function fetchCrosswalksForControls(controlIds: string[]): Promise<CrosswalkRow[]> {
  if (controlIds.length === 0) return [];
  const { data, error } = await supabase
    .from("crosswalks")
    .select("source_control_id, target_control_id, mapping_type, target:controls!crosswalks_target_control_id_fkey(control_ref, framework_id)")
    .in("source_control_id", controlIds);
  if (error) throw error;
  return (data ?? []) as unknown as CrosswalkRow[];
}

async function fetchEvidenceCountsForCompany(companyId: string): Promise<EvidenceCountRow[]> {
  // Pull every (control_id, evidence_id) tagged for this company and count
  // per control_id client-side. Volume is bounded (per company), so this is
  // simpler than a SQL aggregate view.
  const { data, error } = await supabase
    .from("company_controls")
    .select("control_id, evidence_controls(evidence_id)")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []).map((cc) => ({
    control_id: cc.control_id,
    count: cc.evidence_controls?.length ?? 0,
  }));
}

export default function Controls() {
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [type, setType] = useState("all");
  const [evState, setEvState] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheetControl, setSheetControl] = useState<ControlRow | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const controlsQuery = useQuery({ queryKey: ["sf-controls"], queryFn: fetchSecureframeControls });
  const controls = controlsQuery.data ?? [];

  const crosswalksQuery = useQuery({
    queryKey: ["sf-crosswalks", controls.map((c) => c.id)],
    queryFn: () => fetchCrosswalksForControls(controls.map((c) => c.id)),
    enabled: controls.length > 0,
  });

  const evidenceCountsQuery = useQuery({
    queryKey: ["evidence-counts", activeCompany?.id],
    queryFn: () => fetchEvidenceCountsForCompany(activeCompany!.id),
    enabled: !!activeCompany,
  });

  const evidenceCountByControlId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of evidenceCountsQuery.data ?? []) m.set(r.control_id, r.count);
    return m;
  }, [evidenceCountsQuery.data]);

  const crosswalksByControl = useMemo(() => {
    const m = new Map<string, CrosswalkRow[]>();
    for (const cw of crosswalksQuery.data ?? []) {
      if (!m.has(cw.source_control_id)) m.set(cw.source_control_id, []);
      m.get(cw.source_control_id)!.push(cw);
    }
    return m;
  }, [crosswalksQuery.data]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, ControlRow[]>();
    for (const c of controls) {
      if (c.parent_control_id) {
        if (!m.has(c.parent_control_id)) m.set(c.parent_control_id, []);
        m.get(c.parent_control_id)!.push(c);
      }
    }
    return m;
  }, [controls]);

  const domains = useMemo(
    () =>
      Array.from(new Set(controls.map((c) => c.domain ?? "").filter(Boolean))).sort(),
    [controls],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return controls.filter((c) => {
      if (domain !== "all" && c.domain !== domain) return false;
      if (type === "parent" && c.parent_control_id) return false;
      if (type === "child" && !c.parent_control_id) return false;
      const has = (evidenceCountByControlId.get(c.id) || 0) > 0;
      if (evState === "has" && !has) return false;
      if (evState === "missing" && has) return false;
      if (selectedSources.size > 0) {
        const hits = c.source_hints ?? [];
        if (!hits.some((h) => selectedSources.has(h))) return false;
      }
      if (q) {
        const blob = `${c.control_ref} ${c.description ?? ""} ${c.domain ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [controls, search, domain, type, evState, evidenceCountByControlId, selectedSources]);

  const parents = filtered.filter((c) => !c.parent_control_id);
  const visibleParentIds = new Set(parents.map((p) => p.id));
  const orphans = filtered.filter((c) => c.parent_control_id && !visibleParentIds.has(c.parent_control_id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function sourceBadges(hints: string[] | null | undefined) {
    if (!hints || hints.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {hints.map((h) => (
          <Badge key={h} variant="outline" className="text-[10px]">
            {h}
          </Badge>
        ))}
      </div>
    );
  }

  function statusBadge(controlId: string) {
    if (!activeCompany) return <Badge variant="outline">—</Badge>;
    const count = evidenceCountByControlId.get(controlId) || 0;
    if (count === 0) return <Badge variant="outline">No evidence</Badge>;
    return <Badge>{count} mapped</Badge>;
  }

  function crosswalkBadges(controlId: string) {
    const items = crosswalksByControl.get(controlId) ?? [];
    if (items.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    // Show only direct/effective SOC 2 mappings for compactness.
    const visible = items.filter((cw) => cw.mapping_type === "direct" || cw.mapping_type === "effective");
    if (visible.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    const seen = new Set<string>();
    const refs = visible
      .map((cw) => cw.target?.control_ref)
      .filter((r): r is string => !!r)
      .filter((r) => {
        if (seen.has(r)) return false;
        seen.add(r);
        return true;
      });
    return (
      <div className="flex flex-wrap gap-1">
        {refs.map((r) => (
          <Badge key={r} variant="secondary">
            {r}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Controls Library"
        description={
          activeCompany
            ? `Workspace: ${activeCompany.name} · ${controls.length} Secureframe controls`
            : `${controls.length} Secureframe controls (no company selected)`
        }
      />

      {!activeCompany && (
        <Card className="mb-4">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Pick a company in the sidebar to see evidence counts. <Link to="/companies" className="text-primary underline">Manage companies</Link>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search code, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="parent">Parent only</SelectItem>
                <SelectItem value="child">Child only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={evState} onValueChange={setEvState}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All evidence states</SelectItem>
                <SelectItem value="has">Has evidence</SelectItem>
                <SelectItem value="missing">Missing evidence</SelectItem>
              </SelectContent>
            </Select>
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-28">Code</TableHead>
              <TableHead className="w-40">Domain</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-40">SOC 2</TableHead>
              <TableHead className="w-44">Source</TableHead>
              <TableHead className="w-32">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {controlsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : controlsQuery.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-destructive">
                  {(controlsQuery.error as Error).message}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {parents.map((p) => {
                  const kids = childrenByParent.get(p.id) ?? [];
                  const isOpen = expanded.has(p.id);
                  return (
                    <Fragment key={p.id}>
                      <TableRow className="font-medium cursor-pointer hover:bg-muted/40" onClick={() => setSheetControl(p)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {kids.length > 0 && (
                            <button onClick={() => toggle(p.id)} className="p-0.5">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.control_ref}</TableCell>
                        <TableCell>{p.domain}</TableCell>
                        <TableCell className="text-sm">{p.description}</TableCell>
                        <TableCell>{crosswalkBadges(p.id)}</TableCell>
                        <TableCell>{sourceBadges(p.source_hints)}</TableCell>
                        <TableCell>{statusBadge(p.id)}</TableCell>
                      </TableRow>
                      {isOpen &&
                        kids.map((k) => (
                          <TableRow key={k.id} className="bg-muted/30 cursor-pointer hover:bg-muted/60" onClick={() => setSheetControl(k)}>
                            <TableCell></TableCell>
                            <TableCell className="font-mono text-xs pl-6 text-muted-foreground">{k.control_ref}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{k.domain}</TableCell>
                            <TableCell className="text-sm">{k.description}</TableCell>
                            <TableCell>{crosswalkBadges(k.id)}</TableCell>
                            <TableCell>{sourceBadges(k.source_hints)}</TableCell>
                            <TableCell>{statusBadge(k.id)}</TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  );
                })}
                {orphans.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSheetControl(c)}>
                    <TableCell></TableCell>
                    <TableCell className="font-mono text-xs">{c.control_ref}</TableCell>
                    <TableCell>{c.domain}</TableCell>
                    <TableCell className="text-sm">{c.description}</TableCell>
                    <TableCell>{crosswalkBadges(c.id)}</TableCell>
                    <TableCell>{sourceBadges(c.source_hints)}</TableCell>
                    <TableCell>{statusBadge(c.id)}</TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      <ControlSheet
        open={!!sheetControl}
        onOpenChange={(o) => { if (!o) setSheetControl(null); }}
        control={sheetControl}
        companyId={activeCompany?.id ?? null}
      />
    </Layout>
  );
}
