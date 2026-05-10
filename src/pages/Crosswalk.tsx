import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csv";

type Framework = { id: string; slug: string; name: string };

type CrosswalkJoinRow = {
  id: string;
  mapping_type: string;
  source_control_id: string;
  target_control_id: string;
  source: { control_ref: string; description: string | null; domain: string | null; framework_id: string } | null;
  target: { control_ref: string; description: string | null; framework_id: string } | null;
};

async function fetchFrameworks(): Promise<Framework[]> {
  const { data, error } = await supabase.from("frameworks").select("id, slug, name").order("name");
  if (error) throw error;
  return data ?? [];
}

async function fetchCrosswalks(sourceFwId: string, targetFwId: string | null): Promise<CrosswalkJoinRow[]> {
  // !inner converts the embedded join into an INNER JOIN so framework_id
  // filters actually narrow the top-level rows (instead of just nulling out
  // the embedded side).
  let query = supabase
    .from("crosswalks")
    .select(
      "id, mapping_type, source_control_id, target_control_id, source:controls!crosswalks_source_control_id_fkey!inner(control_ref, description, domain, framework_id), target:controls!crosswalks_target_control_id_fkey!inner(control_ref, description, framework_id)",
    )
    .eq("source.framework_id", sourceFwId);
  if (targetFwId) query = query.eq("target.framework_id", targetFwId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as CrosswalkJoinRow[]).filter((r) => r.source && r.target);
}

export default function Crosswalk() {
  const frameworksQuery = useQuery({ queryKey: ["frameworks"], queryFn: fetchFrameworks });
  const frameworks = frameworksQuery.data ?? [];

  const sfId = frameworks.find((f) => f.slug === "secureframe")?.id ?? "";
  const soc2Id = frameworks.find((f) => f.slug === "soc2")?.id ?? "";

  const [source, setSource] = useState<string>(sfId);
  const [target, setTarget] = useState<string>(soc2Id);
  const [search, setSearch] = useState("");
  const [mappingType, setMappingType] = useState<string>("all");
  const [domain, setDomain] = useState<string>("all");

  // Initialize defaults once frameworks load.
  useEffect(() => {
    if (!source && sfId) setSource(sfId);
  }, [source, sfId]);
  useEffect(() => {
    if (!target && soc2Id) setTarget(soc2Id);
  }, [target, soc2Id]);

  const crosswalksQuery = useQuery({
    queryKey: ["crosswalks-browse", source, target],
    queryFn: () => fetchCrosswalks(source, target || null),
    enabled: !!source,
  });

  const all = crosswalksQuery.data ?? [];
  const sourceDomains = useMemo(
    () => Array.from(new Set(all.map((cw) => cw.source?.domain ?? "").filter(Boolean))).sort(),
    [all],
  );
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return all.filter((cw) => {
      if (mappingType !== "all" && cw.mapping_type !== mappingType) return false;
      if (domain !== "all" && cw.source?.domain !== domain) return false;
      if (!q) return true;
      const blob = `${cw.source?.control_ref ?? ""} ${cw.target?.control_ref ?? ""} ${cw.source?.description ?? ""} ${cw.target?.description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [all, search, mappingType, domain]);

  function exportCSV() {
    const sourceName = frameworks.find((f) => f.id === source)?.name ?? "source";
    const targetName = frameworks.find((f) => f.id === target)?.name ?? "target";
    const rows = filtered.map((cw) => ({
      [`${sourceName} Ref`]: cw.source?.control_ref ?? "",
      [`${sourceName} Description`]: cw.source?.description ?? "",
      [`${targetName} Ref`]: cw.target?.control_ref ?? "",
      [`${targetName} Description`]: cw.target?.description ?? "",
      "Mapping Type": cw.mapping_type,
    }));
    downloadCSV(`${sourceName}-to-${targetName}.csv`.replace(/\s+/g, "-"), rows);
  }

  return (
    <Layout>
      <PageHeader
        title="Crosswalks"
        description="Browse mappings between framework control catalogs. Read-only for v0; ControlMap integration is the next step."
        actions={
          <Button size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-3">
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Source</span>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Target</span>
            <Select value={target || "all"} onValueChange={(v) => setTarget(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All targets</SelectItem>
                {frameworks
                  .filter((f) => f.id !== source)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={mappingType} onValueChange={setMappingType}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="inherited">Inherited</SelectItem>
              <SelectItem value="effective">Effective</SelectItem>
              <SelectItem value="related">Related</SelectItem>
              <SelectItem value="equivalent">Equivalent</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All source domains</SelectItem>
              {sourceDomains.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search refs or descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm h-8"
          />
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Source</TableHead>
              <TableHead>Source Description</TableHead>
              <TableHead className="w-32">Target</TableHead>
              <TableHead>Target Description</TableHead>
              <TableHead className="w-28">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crosswalksQuery.isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No crosswalks for this filter.</TableCell></TableRow>
            ) : (
              filtered.slice(0, 500).map((cw) => (
                <TableRow key={cw.id}>
                  <TableCell className="font-mono text-xs align-top pt-3">{cw.source?.control_ref}</TableCell>
                  <TableCell className="text-xs align-top pt-3">{cw.source?.description}</TableCell>
                  <TableCell className="font-mono text-xs align-top pt-3">{cw.target?.control_ref}</TableCell>
                  <TableCell className="text-xs align-top pt-3">{cw.target?.description}</TableCell>
                  <TableCell className="align-top pt-3">
                    <Badge variant="secondary" className="text-[10px]">{cw.mapping_type}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > 500 && (
          <div className="p-3 text-xs text-muted-foreground text-center">
            Showing first 500 of {filtered.length}. Refine filters to narrow.
          </div>
        )}
      </Card>
    </Layout>
  );
}
