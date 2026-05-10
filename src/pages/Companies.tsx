import { useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Companies() {
  const { companies, addCompany, deleteCompany, activeCompanyId, setActiveCompanyId, evidence, mappings } =
    useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", notes: "" });

  function submit() {
    if (!form.name.trim()) return;
    const c = addCompany(form);
    setForm({ name: "", industry: "", notes: "" });
    setOpen(false);
    toast({ title: "Company created", description: c.name });
  }

  return (
    <Layout>
      <PageHeader
        title="Companies"
        description="Each company has its own evidence library and mapping status."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New Company</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Company</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Company Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No companies yet. Create one to start mapping evidence.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Mappings</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => {
                const evCount = evidence.filter((e) => e.company_id === c.id).length;
                const mapCount = mappings.filter((m) => m.company_id === c.id).length;
                const isActive = c.id === activeCompanyId;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {isActive ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setActiveCompanyId(c.id)}>
                          <Check className="h-4 w-4" /> Set active
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                    <TableCell>{evCount}</TableCell>
                    <TableCell>{mapCount}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete company "${c.name}" and all its evidence/mappings?`)) deleteCompany(c.id);
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
        </Card>
      )}
    </Layout>
  );
}
