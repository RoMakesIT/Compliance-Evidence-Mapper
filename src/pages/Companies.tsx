import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, Enums } from "@/integrations/supabase/types";

type CompanyRow = Tables<"companies"> & { role: Enums<"company_role"> };

async function fetchCompanies(userId: string): Promise<CompanyRow[]> {
  // Pull every company the current user is a member of, plus their role.
  const { data, error } = await supabase
    .from("company_members")
    .select("role, company:companies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows: CompanyRow[] = [];
  for (const row of data ?? []) {
    if (row.company) rows.push({ ...row.company, role: row.role });
  }
  return rows;
}

export default function Companies() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", notes: "" });

  const companiesQuery = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: () => fetchCompanies(user!.id),
    enabled: !!user,
  });

  const createCompany = useMutation({
    mutationFn: async (input: { name: string; industry: string; notes: string }) => {
      if (!user) throw new Error("Not authenticated");
      const slug = input.name
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
      toast({ title: "Company created", description: c.name });
      setForm({ name: "", industry: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Could not create company", description: e.message, variant: "destructive" });
    },
  });

  const companies = companiesQuery.data ?? [];

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

      {companiesQuery.isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading companies…</CardContent>
        </Card>
      ) : companiesQuery.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            Failed to load: {(companiesQuery.error as Error).message}
          </CardContent>
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
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Layout>
  );
}
