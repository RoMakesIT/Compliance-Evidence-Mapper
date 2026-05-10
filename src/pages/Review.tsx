import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/lib/active-company";
import { downloadCSV } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";

type Mapping = {
  evidence_id: string;
  evidence_title: string;
  evidence_storage_path: string | null;
  evidence_description: string | null;
  control_id: string;
  control_ref: string;
  control_domain: string | null;
  control_description: string | null;
  tagged_at: string;
};

async function fetchMappings(companyId: string): Promise<Mapping[]> {
  // Walk evidence → evidence_controls → company_controls → controls so we can
  // produce one row per (evidence, control) pair.
  const { data, error } = await supabase
    .from("evidence")
    .select(
      "id, title, description, storage_path, evidence_controls(tagged_at, company_controls(control:controls(id, control_ref, domain, description)))",
    )
    .eq("company_id", companyId)
    .order("title", { ascending: true });
  if (error) throw error;

  type Row = {
    id: string;
    title: string;
    description: string | null;
    storage_path: string | null;
    evidence_controls: Array<{
      tagged_at: string;
      company_controls: {
        control: {
          id: string;
          control_ref: string;
          domain: string | null;
          description: string | null;
        } | null;
      } | null;
    }>;
  };

  const out: Mapping[] = [];
  for (const ev of (data ?? []) as Row[]) {
    for (const ec of ev.evidence_controls ?? []) {
      const c = ec.company_controls?.control;
      if (!c) continue;
      out.push({
        evidence_id: ev.id,
        evidence_title: ev.title,
        evidence_description: ev.description,
        evidence_storage_path: ev.storage_path,
        control_id: c.id,
        control_ref: c.control_ref,
        control_domain: c.domain,
        control_description: c.description,
        tagged_at: ec.tagged_at,
      });
    }
  }
  return out;
}

export default function Review() {
  const { activeCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"control" | "evidence">("control");

  const mappingsQuery = useQuery({
    queryKey: ["mappings", activeCompany?.id],
    queryFn: () => fetchMappings(activeCompany!.id),
    enabled: !!activeCompany,
  });

  const filtered = useMemo(() => {
    const all = mappingsQuery.data ?? [];
    const q = search.toLowerCase().trim();
    if (!q) return all;
    return all.filter((m) => {
      const blob = `${m.control_ref} ${m.control_domain ?? ""} ${m.control_description ?? ""} ${m.evidence_title} ${m.evidence_description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [mappingsQuery.data, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    if (groupBy === "control") {
      rows.sort(
        (a, b) =>
          a.control_ref.localeCompare(b.control_ref) ||
          a.evidence_title.localeCompare(b.evidence_title),
      );
    } else {
      rows.sort(
        (a, b) =>
          a.evidence_title.localeCompare(b.evidence_title) ||
          a.control_ref.localeCompare(b.control_ref),
      );
    }
    return rows;
  }, [filtered, groupBy]);

  async function downloadFile(storagePath: string) {
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(storagePath, 60);
    if (error || !data) {
      toast({ title: "Could not generate link", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function exportCSV() {
    if (!activeCompany) return;
    const rows = sorted.map((m) => ({
      Company: activeCompany.name,
      "Control Ref": m.control_ref,
      Domain: m.control_domain ?? "",
      "Control Description": m.control_description ?? "",
      "Evidence Title": m.evidence_title,
      "Evidence Description": m.evidence_description ?? "",
      "Evidence File": m.evidence_storage_path?.split("/").pop() ?? "",
      "Tagged At": m.tagged_at,
    }));
    downloadCSV(`${activeCompany.name}-mappings.csv`, rows);
  }

  if (!activeCompany) {
    return (
      <Layout>
        <PageHeader title="Mappings" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active company. Pick one in the sidebar, or{" "}
            <Link to="/companies" className="text-primary underline">
              create a company
            </Link>
            .
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Mappings"
        description={`Workspace: ${activeCompany.name}`}
        actions={
          <Button size="sm" onClick={exportCSV} disabled={sorted.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input
            placeholder="Search control, evidence, domain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <Button
              size="sm"
              variant={groupBy === "control" ? "secondary" : "ghost"}
              onClick={() => setGroupBy("control")}
            >
              Control
            </Button>
            <Button
              size="sm"
              variant={groupBy === "evidence" ? "secondary" : "ghost"}
              onClick={() => setGroupBy("evidence")}
            >
              Evidence
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Control</TableHead>
              <TableHead className="w-40">Domain</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead className="w-40">File</TableHead>
              <TableHead className="w-32">Tagged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappingsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No mappings yet. Tag evidence on the{" "}
                  <Link to="/evidence" className="text-primary underline">
                    Evidence
                  </Link>{" "}
                  page.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((m, idx) => (
                <TableRow key={`${m.evidence_id}-${m.control_id}-${idx}`}>
                  <TableCell className="font-mono text-xs">{m.control_ref}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.control_domain ? <Badge variant="outline">{m.control_domain}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{m.evidence_title}</div>
                    {m.evidence_description && (
                      <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">
                        {m.evidence_description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.evidence_storage_path ? (
                      <button
                        className="hover:text-foreground inline-flex items-center gap-1"
                        onClick={() => downloadFile(m.evidence_storage_path!)}
                      >
                        <Download className="h-3 w-3" />
                        {m.evidence_storage_path.split("/").pop()}
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.tagged_at).toLocaleDateString()}
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
