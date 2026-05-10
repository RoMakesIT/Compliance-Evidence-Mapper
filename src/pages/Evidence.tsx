import { useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Sparkles, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { matchEvidence, buildMappingsFromMatches } from "@/lib/matching";
import { Link } from "react-router-dom";

export default function EvidencePage() {
  const {
    activeCompanyId,
    companies,
    evidence,
    addEvidence,
    deleteEvidence,
    controls,
    addMappings,
    mappings,
  } = useStore();
  const company = companies.find((c) => c.id === activeCompanyId);
  const myEvidence = evidence.filter((e) => e.company_id === activeCompanyId);

  const [form, setForm] = useState({
    title: "",
    file_name: "",
    file_type: "",
    description: "",
    extracted_text: "",
    notes: "",
  });

  if (!company) {
    return (
      <Layout>
        <PageHeader title="Evidence" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select an active company first. <Link to="/companies" className="text-primary underline">Manage companies</Link>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  function onFile(f: File | null) {
    if (!f) return;
    setForm((p) => ({
      ...p,
      file_name: f.name,
      file_type: f.type || f.name.split(".").pop() || "",
      title: p.title || f.name.replace(/\.[^.]+$/, ""),
    }));
    if (f.type.startsWith("text/") || /\.(txt|md|csv|json|log)$/i.test(f.name)) {
      const reader = new FileReader();
      reader.onload = () => setForm((p) => ({ ...p, extracted_text: String(reader.result || "") }));
      reader.readAsText(f);
    }
  }

  function submit(autoSuggest: boolean) {
    if (!form.title.trim()) {
      toast({ title: "Title required" });
      return;
    }
    const ev = addEvidence({ ...form, company_id: company!.id });
    if (autoSuggest) {
      const matches = matchEvidence(ev, controls);
      if (matches.length === 0) {
        toast({ title: "Evidence saved", description: "No keyword matches found — add manual mapping in Review." });
      } else {
        const ms = buildMappingsFromMatches(ev.id, company!.id, matches);
        addMappings(ms);
        toast({ title: "Evidence saved", description: `${ms.length} suggested controls. Review them next.` });
      }
    } else {
      toast({ title: "Evidence saved" });
    }
    setForm({ title: "", file_name: "", file_type: "", description: "", extracted_text: "", notes: "" });
  }

  return (
    <Layout>
      <PageHeader title="Evidence" description={`Workspace: ${company.name}`} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-medium text-sm">Add Evidence</h3>
            <div>
              <Label>File (optional)</Label>
              <Input type="file" onChange={(e) => onFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>File Name</Label>
                <Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} />
              </div>
              <div>
                <Label>File Type</Label>
                <Input value={form.file_type} onChange={(e) => setForm({ ...form, file_type: e.target.value })} />
              </div>
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
              <Label>Extracted / Pasted Text</Label>
              <Textarea
                rows={6}
                value={form.extracted_text}
                onChange={(e) => setForm({ ...form, extracted_text: e.target.value })}
                placeholder="Paste text content here for keyword matching."
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => submit(true)}>
                <Sparkles className="h-4 w-4" /> Save & Suggest Controls
              </Button>
              <Button variant="outline" onClick={() => submit(false)}>
                <Upload className="h-4 w-4" /> Save Only
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b text-sm font-medium">
              Evidence ({myEvidence.length})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Mappings</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myEvidence.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No evidence yet.
                    </TableCell>
                  </TableRow>
                )}
                {myEvidence.map((e) => {
                  const count = mappings.filter((m) => m.evidence_id === e.id).length;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.file_name || "—"}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.uploaded_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete evidence "${e.title}"?`)) deleteEvidence(e.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
