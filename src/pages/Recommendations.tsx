import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { RecommendationStatus } from "@/lib/types";
import { downloadCSV } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";

const STATUSES: RecommendationStatus[] = ["Draft", "Reviewed", "Included in Report", "Deferred"];

export default function Recommendations() {
  const {
    activeCompanyId,
    companies,
    controls,
    mappings,
    recommendations,
    addRecommendation,
    updateRecommendation,
    deleteRecommendation,
  } = useStore();
  const company = companies.find((c) => c.id === activeCompanyId);
  const myRecs = useMemo(
    () => recommendations.filter((r) => r.company_id === activeCompanyId),
    [recommendations, activeCompanyId],
  );
  const [filter, setFilter] = useState<string>("all");

  if (!company) {
    return (
      <Layout>
        <PageHeader title="Recommendations" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select an active company first. <Link to="/companies" className="text-primary underline">Manage companies</Link>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  function generateGaps() {
    const approved = new Set(
      mappings
        .filter(
          (m) =>
            m.company_id === company!.id && (m.mapping_status === "Approved" || m.mapping_status === "Manual"),
        )
        .map((m) => m.control_id),
    );
    const existingRec = new Set(myRecs.map((r) => r.control_id));
    let added = 0;
    controls.forEach((c) => {
      if (!approved.has(c.id) && !existingRec.has(c.id) && c.recommendation_template) {
        addRecommendation({
          company_id: company!.id,
          control_id: c.id,
          recommendation_text: c.recommendation_template,
          priority: c.parent_control_code ? "Medium" : "High",
          status: "Draft",
          notes: "",
        });
        added++;
      }
    });
    toast({ title: `Generated ${added} draft recommendations` });
  }

  function exportRecs() {
    const rows = myRecs.map((r) => {
      const c = controls.find((x) => x.id === r.control_id);
      return {
        Company: company!.name,
        "Control Code": c?.control_code || "",
        "SOC 2 Criteria": c?.soc2_effective_mapping || "",
        "Recommendation Text": r.recommendation_text,
        Priority: r.priority,
        Status: r.status,
        Notes: r.notes,
      };
    });
    downloadCSV(`${company!.name}-recommendations.csv`, rows);
  }

  const filtered = filter === "all" ? myRecs : myRecs.filter((r) => r.status === filter);

  return (
    <Layout>
      <PageHeader
        title="Recommendations"
        description={`Workspace: ${company.name}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={generateGaps}>
              <Wand2 className="h-4 w-4" /> Draft from Gaps
            </Button>
            <Button size="sm" onClick={exportRecs}>Export</Button>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} of {myRecs.length}</span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Control</TableHead>
              <TableHead className="w-32">SOC 2</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead className="w-28">Priority</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No recommendations. Click "Draft from Gaps" to seed.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const c = controls.find((x) => x.id === r.control_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{c?.control_code}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c?.soc2_effective_mapping || "")
                        .split(/[,;]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={r.recommendation_text}
                      onChange={(e) => updateRecommendation(r.id, { recommendation_text: e.target.value })}
                      className="text-xs min-h-[60px]"
                    />
                    <Textarea
                      value={r.notes}
                      onChange={(e) => updateRecommendation(r.id, { notes: e.target.value })}
                      placeholder="Notes…"
                      className="text-xs min-h-[40px] mt-1"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.priority}
                      onValueChange={(v) => updateRecommendation(r.id, { priority: v as "Low" | "Medium" | "High" })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateRecommendation(r.id, { status: v as RecommendationStatus })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => deleteRecommendation(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </Layout>
  );
}
