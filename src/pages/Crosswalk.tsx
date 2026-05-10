import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore, newId } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrosswalkStatus } from "@/lib/types";
import { downloadCSV } from "@/lib/csv";

const STATUSES: CrosswalkStatus[] = ["Not Started", "Suggested", "Reviewed", "Confirmed", "Rejected"];

export default function Crosswalk() {
  const { controls, crosswalks, upsertCrosswalk, deleteCrosswalk } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const byControl = useMemo(() => {
    const m = new Map<string, typeof crosswalks[number]>();
    crosswalks.forEach((c) => m.set(c.control_id, c));
    return m;
  }, [crosswalks]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return controls.filter((c) => {
      const cw = byControl.get(c.id);
      const status = cw?.review_status || "Not Started";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (q && !`${c.control_code} ${c.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [controls, byControl, search, statusFilter]);

  function update(controlId: string, patch: Partial<(typeof crosswalks)[number]>) {
    const existing = byControl.get(controlId);
    upsertCrosswalk({
      id: existing?.id || newId(),
      control_id: controlId,
      controlmap_control_name: existing?.controlmap_control_name || "",
      controlmap_notes: existing?.controlmap_notes || "",
      confidence: existing?.confidence ?? 0,
      review_status: existing?.review_status || "Not Started",
      ...patch,
    });
  }

  function exportCrosswalk() {
    const rows = controls.map((c) => {
      const cw = byControl.get(c.id);
      return {
        "Secureframe Control Code": c.control_code,
        "Secureframe Description": c.description,
        "SOC 2 Effective Mapping": c.soc2_effective_mapping,
        "Suggested ControlMap Control Name": cw?.controlmap_control_name || "",
        "ControlMap Notes": cw?.controlmap_notes || "",
        Confidence: cw?.confidence ?? "",
        "Review Status": cw?.review_status || "Not Started",
      };
    });
    downloadCSV("controlmap-crosswalk.csv", rows);
  }

  return (
    <Layout>
      <PageHeader
        title="ControlMap Crosswalk"
        description="Map Secureframe-derived controls to ControlMap baseline controls."
        actions={<Button size="sm" onClick={exportCrosswalk}>Export</Button>}
      />

      <Card className="mb-3">
        <CardContent className="p-3 flex gap-2">
          <Input
            placeholder="Search control code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Code</TableHead>
              <TableHead className="w-[28%]">Secureframe Description</TableHead>
              <TableHead>ControlMap Control Name</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-24">Conf.</TableHead>
              <TableHead className="w-40">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.slice(0, 200).map((c) => {
              const cw = byControl.get(c.id);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs align-top pt-3">{c.control_code}</TableCell>
                  <TableCell className="text-xs align-top pt-3">{c.description}</TableCell>
                  <TableCell>
                    <Input
                      value={cw?.controlmap_control_name || ""}
                      onChange={(e) => update(c.id, { controlmap_control_name: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={cw?.controlmap_notes || ""}
                      onChange={(e) => update(c.id, { controlmap_notes: e.target.value })}
                      className="text-xs min-h-[40px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={cw?.confidence ?? 0}
                      onChange={(e) => update(c.id, { confidence: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Select
                        value={cw?.review_status || "Not Started"}
                        onValueChange={(v) => update(c.id, { review_status: v as CrosswalkStatus })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {cw && (
                        <Button size="sm" variant="ghost" onClick={() => deleteCrosswalk(cw.id)}>×</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {visible.length > 200 && (
          <div className="p-3 text-xs text-muted-foreground text-center">
            Showing first 200 of {visible.length}. Refine search to narrow.
          </div>
        )}
      </Card>
    </Layout>
  );
}
