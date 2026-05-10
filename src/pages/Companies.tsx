import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveCompany } from "@/lib/active-company";

export default function Companies() {
  const { user } = useAuth();
  const { companies, activeCompany, loading, setActiveCompanyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", notes: "" });

  const createCompany = useMutation({
    mutationFn: async (input: { name: string; industry: string; notes: string }) => {
      if (!user) throw new Error("Not authenticated");
      const slug =
        input.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || null;
      const { data, error } = await supabase.rpc("create_company", {
        p_name: input.name.trim(),
        p_slug: slug,
        p_industry: input.industry.trim() || null,
        p_notes: input.notes.trim() || null,
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setActiveCompanyId(c.id);
      toast({ title: "Company created", description: c.name });
      setForm({ name: "", industry: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Could not create company", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Layout>
      <PageHeader
        title="Companies"
        description="Each company has its own evidence library and control adoption."
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
                <Button
                  onClick={() => {
                    if (!form.name.trim()) return;
                    createCompany.mutate(form);
                  }}
                  disabled={createCompany.isPending || !form.name.trim()}
                >
                  {createCompany.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading companies…</CardContent>
        </Card>
      ) : companies.length === 0 ? (
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
                <TableHead className="w-28"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => {
                const isActive = c.id === activeCompany?.id;
                return (
                  <TableRow key={c.id} className={isActive ? "bg-muted/40" : ""}>
                    <TableCell>
                      {isActive ? (
                        <Badge className="gap-1">
                          <Check className="h-3 w-3" /> Active
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveCompanyId(c.id);
                            toast({ title: "Active workspace", description: c.name });
                          }}
                        >
                          Set active
                        </Button>
                      )}
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
