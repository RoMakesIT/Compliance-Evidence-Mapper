import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload, Tag, Download, Pencil } from "lucide-react";
import { SOURCE_SYSTEMS } from "@/lib/source-systems";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveCompany } from "@/lib/active-company";
import { ControlPicker } from "@/components/ControlPicker";
import type { Tables } from "@/integrations/supabase/types";

type EvidenceRow = Tables<"evidence">;
type EvidenceWithTags = EvidenceRow & {
  tags: Array<{ company_control_id: string; control_id: string; control_ref: string }>;
};

async function fetchEvidence(companyId: string): Promise<EvidenceWithTags[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(
      "*, evidence_controls(company_control_id, company_controls(control_id, control:controls(control_ref)))",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    type RowWithTags = EvidenceRow & {
      evidence_controls: Array<{
        company_control_id: string;
        company_controls: { control_id: string; control: { control_ref: string } | null } | null;
      }>;
    };
    const r = row as RowWithTags;
    const tags = (r.evidence_controls ?? []).flatMap((ec) => {
      if (!ec.company_controls) return [];
      return [
        {
          company_control_id: ec.company_control_id,
          control_id: ec.company_controls.control_id,
          control_ref: ec.company_controls.control?.control_ref ?? "?",
        },
      ];
    });
    return { ...row, tags };
  });
}

export default function EvidencePage() {
  const { user } = useAuth();
  const { activeCompany } = useActiveCompany();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    source_system: "" as string,
    file: null as File | null,
  });
  const [pickerEvidence, setPickerEvidence] = useState<EvidenceWithTags | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<EvidenceWithTags | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", source_system: "" });
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<"all" | "tagged" | "untagged">("all");

  const evidenceQuery = useQuery({
    queryKey: ["evidence", activeCompany?.id],
    queryFn: () => fetchEvidence(activeCompany!.id),
    enabled: !!activeCompany,
  });

  const uploadEvidence = useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      source_system: string;
      file: File | null;
    }) => {
      if (!activeCompany || !user) throw new Error("No active company");

      // 1. Insert evidence row first to get its id (used in storage path).
      const { data: ev, error: evErr } = await supabase
        .from("evidence")
        .insert({
          company_id: activeCompany.id,
          title: input.title.trim(),
          description: input.description.trim() || null,
          source_system: input.source_system || null,
          collected_by: user.id,
          collected_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (evErr) throw evErr;

      // 2. If a file is present, upload it under {company_id}/{evidence_id}/.
      if (input.file) {
        const path = `${activeCompany.id}/${ev.id}/${input.file.name}`;
        const { error: upErr } = await supabase.storage
          .from("evidence")
          .upload(path, input.file, { upsert: false });
        if (upErr) {
          // Roll back the evidence row so we don't leave orphaned metadata.
          await supabase.from("evidence").delete().eq("id", ev.id);
          throw upErr;
        }
        const { error: updErr } = await supabase
          .from("evidence")
          .update({
            storage_path: path,
            mime_type: input.file.type || null,
            file_size: input.file.size,
          })
          .eq("id", ev.id);
        if (updErr) throw updErr;
      }

      return ev;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["evidence-counts", activeCompany?.id] });
      setForm({ title: "", description: "", source_system: "", file: null });
      const fileInput = document.getElementById("evidence-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      toast({ title: "Evidence saved" });
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  const updateEvidence = useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description: string;
      source_system: string;
    }) => {
      const { error } = await supabase
        .from("evidence")
        .update({
          title: input.title.trim(),
          description: input.description.trim() || null,
          source_system: input.source_system || null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["mappings", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["control-evidence", activeCompany?.id] });
      setEditingEvidence(null);
      toast({ title: "Evidence updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteEvidence = useMutation({
    mutationFn: async (ev: EvidenceWithTags) => {
      // Best-effort storage cleanup before the metadata row is removed.
      if (ev.storage_path) {
        await supabase.storage.from("evidence").remove([ev.storage_path]);
      }
      const { error } = await supabase.from("evidence").delete().eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["evidence-counts", activeCompany?.id] });
      toast({ title: "Evidence deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const setTags = useMutation({
    mutationFn: async ({ evidence, controlIds }: { evidence: EvidenceWithTags; controlIds: string[] }) => {
      if (!activeCompany) throw new Error("No active company");

      // Reconcile current tags vs desired set.
      const currentByControlId = new Map(evidence.tags.map((t) => [t.control_id, t.company_control_id]));
      const desiredSet = new Set(controlIds);

      // Remove tags no longer wanted.
      const toRemove: string[] = [];
      for (const [ctrlId, ccId] of currentByControlId) {
        if (!desiredSet.has(ctrlId)) toRemove.push(ccId);
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("evidence_controls")
          .delete()
          .eq("evidence_id", evidence.id)
          .in("company_control_id", toRemove);
        if (error) throw error;
      }

      // Add tags for newly selected controls. For each, ensure a
      // company_controls row exists, then insert evidence_controls.
      const toAdd = controlIds.filter((cid) => !currentByControlId.has(cid));
      for (const controlId of toAdd) {
        // Upsert company_controls (company_id, control_id).
        const { data: cc, error: ccErr } = await supabase
          .from("company_controls")
          .upsert(
            { company_id: activeCompany.id, control_id: controlId },
            { onConflict: "company_id,control_id" },
          )
          .select("id")
          .single();
        if (ccErr) throw ccErr;
        const { error: ecErr } = await supabase
          .from("evidence_controls")
          .insert({ evidence_id: evidence.id, company_control_id: cc.id, tagged_by: user?.id ?? null });
        if (ecErr) throw ecErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", activeCompany?.id] });
      qc.invalidateQueries({ queryKey: ["evidence-counts", activeCompany?.id] });
      toast({ title: "Tags updated" });
    },
    onError: (e: Error) => toast({ title: "Tag update failed", description: e.message, variant: "destructive" }),
  });

  async function handleDownload(ev: EvidenceWithTags) {
    if (!ev.storage_path) return;
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(ev.storage_path, 60);
    if (error || !data) {
      toast({ title: "Could not generate link", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (!activeCompany) {
    return (
      <Layout>
        <PageHeader title="Evidence" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select an active company first.{" "}
            <Link to="/companies" className="text-primary underline">
              Manage companies
            </Link>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const evidence = evidenceQuery.data ?? [];
  const filteredEvidence = useMemo(() => {
    const q = search.toLowerCase().trim();
    return evidence.filter((ev) => {
      if (sourceFilter !== "all" && (ev.source_system ?? "") !== sourceFilter) return false;
      if (tagFilter === "tagged" && ev.tags.length === 0) return false;
      if (tagFilter === "untagged" && ev.tags.length > 0) return false;
      if (!q) return true;
      const blob = `${ev.title} ${ev.description ?? ""} ${ev.source_system ?? ""} ${ev.storage_path ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [evidence, search, sourceFilter, tagFilter]);

  return (
    <Layout>
      <PageHeader title="Evidence" description={`Workspace: ${activeCompany.name}`} />

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-medium text-sm">Add Evidence</h3>
            <div>
              <Label htmlFor="evidence-file">File (optional)</Label>
              <Input
                id="evidence-file"
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setForm((p) => ({
                    ...p,
                    file: f,
                    title: p.title || (f ? f.name.replace(/\.[^.]+$/, "") : ""),
                  }));
                }}
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this evidence show?"
              />
            </div>
            <div>
              <Label>Source system</Label>
              <Select
                value={form.source_system || "_none"}
                onValueChange={(v) => setForm({ ...form, source_system: v === "_none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Where did this come from?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— unset —</SelectItem>
                  {SOURCE_SYSTEMS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!form.title.trim()) {
                  toast({ title: "Title required" });
                  return;
                }
                uploadEvidence.mutate(form);
              }}
              disabled={uploadEvidence.isPending}
            >
              <Upload className="h-4 w-4" /> {uploadEvidence.isPending ? "Saving…" : "Save evidence"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium">
                Evidence{" "}
                <span className="text-muted-foreground font-normal">
                  ({filteredEvidence.length === evidence.length
                    ? evidence.length
                    : `${filteredEvidence.length} of ${evidence.length}`})
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Search title, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 max-w-[200px]"
                />
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {SOURCE_SYSTEMS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tagFilter} onValueChange={(v) => setTagFilter(v as typeof tagFilter)}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All evidence</SelectItem>
                    <SelectItem value="tagged">Tagged</SelectItem>
                    <SelectItem value="untagged">Untagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-28">Source</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredEvidence.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      {evidence.length === 0 ? "No evidence yet." : "No evidence matches the current filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvidence.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium align-top">
                        <div>{ev.title}</div>
                        {ev.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">{ev.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {ev.source_system ? (
                          <Badge variant="outline" className="text-[10px]">{ev.source_system}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        {ev.storage_path ? (
                          <button className="hover:text-foreground inline-flex items-center gap-1" onClick={() => handleDownload(ev)}>
                            <Download className="h-3 w-3" />
                            {ev.storage_path.split("/").pop()}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ev.tags.length === 0 ? (
                            <span className="text-xs text-muted-foreground">untagged</span>
                          ) : (
                            ev.tags.map((t) => (
                              <Badge key={t.company_control_id} variant="secondary" className="font-mono text-[10px]">
                                {t.control_ref}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPickerEvidence(ev)} title="Tag controls">
                            <Tag className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingEvidence(ev);
                              setEditForm({
                                title: ev.title,
                                description: ev.description ?? "",
                                source_system: ev.source_system ?? "",
                              });
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete "${ev.title}"?`)) deleteEvidence.mutate(ev);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!editingEvidence}
        onOpenChange={(o) => {
          if (!o) setEditingEvidence(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit evidence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={5}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What does this evidence show? Keywords here are used for tag suggestions."
              />
            </div>
            <div>
              <Label>Source system</Label>
              <Select
                value={editForm.source_system || "_none"}
                onValueChange={(v) =>
                  setEditForm((p) => ({ ...p, source_system: v === "_none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Where did this come from?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— unset —</SelectItem>
                  {SOURCE_SYSTEMS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              The title and description feed into the keyword scorer that powers the
              "Suggested" controls in the tag picker — adding domain words here makes
              future re-tagging more accurate. The file itself isn't replaced; delete and
              re-upload to swap files.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingEvidence(null)} disabled={updateEvidence.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingEvidence || !editForm.title.trim()) return;
                updateEvidence.mutate({
                  id: editingEvidence.id,
                  title: editForm.title,
                  description: editForm.description,
                  source_system: editForm.source_system,
                });
              }}
              disabled={updateEvidence.isPending || !editForm.title.trim()}
            >
              {updateEvidence.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ControlPicker
        open={!!pickerEvidence}
        onOpenChange={(o) => {
          if (!o) setPickerEvidence(null);
        }}
        selectedControlIds={new Set(pickerEvidence?.tags.map((t) => t.control_id) ?? [])}
        evidenceText={
          pickerEvidence
            ? [pickerEvidence.title, pickerEvidence.description, pickerEvidence.storage_path?.split("/").pop()]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        evidenceSource={pickerEvidence?.source_system ?? null}
        onConfirm={async (controlIds) => {
          if (pickerEvidence) {
            await setTags.mutateAsync({ evidence: pickerEvidence, controlIds });
          }
        }}
      />
    </Layout>
  );
}
