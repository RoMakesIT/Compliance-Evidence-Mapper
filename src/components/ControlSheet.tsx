import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X as XIcon, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ControlRow = Tables<"controls">;

type TaggedEvidence = {
  evidence_id: string;
  company_control_id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  created_at: string;
};

async function fetchTaggedEvidence(companyId: string, controlId: string): Promise<TaggedEvidence[]> {
  // Look up via company_controls → evidence_controls → evidence.
  const { data, error } = await supabase
    .from("company_controls")
    .select(
      "id, evidence_controls(evidence:evidence(id, title, description, storage_path, created_at))",
    )
    .eq("company_id", companyId)
    .eq("control_id", controlId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return [];
  type Row = {
    id: string;
    evidence_controls: Array<{
      evidence: {
        id: string;
        title: string;
        description: string | null;
        storage_path: string | null;
        created_at: string;
      } | null;
    }>;
  };
  const r = data as Row;
  return (r.evidence_controls ?? [])
    .filter((ec) => !!ec.evidence)
    .map((ec) => ({
      evidence_id: ec.evidence!.id,
      company_control_id: r.id,
      title: ec.evidence!.title,
      description: ec.evidence!.description,
      storage_path: ec.evidence!.storage_path,
      created_at: ec.evidence!.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  control: ControlRow | null;
  companyId: string | null;
}

export function ControlSheet({ open, onOpenChange, control, companyId }: Props) {
  const qc = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ["control-evidence", companyId, control?.id],
    queryFn: () => fetchTaggedEvidence(companyId!, control!.id),
    enabled: !!control && !!companyId && open,
  });

  const untag = useMutation({
    mutationFn: async (t: TaggedEvidence) => {
      const { error } = await supabase
        .from("evidence_controls")
        .delete()
        .eq("evidence_id", t.evidence_id)
        .eq("company_control_id", t.company_control_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["control-evidence", companyId, control?.id] });
      qc.invalidateQueries({ queryKey: ["evidence-counts", companyId] });
      qc.invalidateQueries({ queryKey: ["evidence", companyId] });
      toast({ title: "Untagged" });
    },
    onError: (e: Error) => toast({ title: "Untag failed", description: e.message, variant: "destructive" }),
  });

  async function downloadEvidence(t: TaggedEvidence) {
    if (!t.storage_path) return;
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(t.storage_path, 60);
    if (error || !data) {
      toast({ title: "Could not generate link", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const tags = tagsQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{control?.control_ref}</SheetTitle>
          {control?.domain && (
            <SheetDescription>
              <Badge variant="outline" className="mr-1">{control.domain}</Badge>
              {control.control_type === "child" && <Badge variant="secondary">child</Badge>}
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {control?.description && (
              <Section title="Description">
                <p className="text-sm">{control.description}</p>
              </Section>
            )}

            {control?.recommendation_template && (
              <Section title="Recommendation">
                <p className="text-sm text-muted-foreground">{control.recommendation_template}</p>
              </Section>
            )}

            {control?.evidence_examples && (
              <Section title="Suggested evidence">
                <p className="text-sm text-muted-foreground">{control.evidence_examples}</p>
              </Section>
            )}

            {control?.evidence_keywords && (
              <Section title="Keywords">
                <div className="flex flex-wrap gap-1">
                  {control.evidence_keywords
                    .split(/[;,]/)
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">
                        {k}
                      </Badge>
                    ))}
                </div>
              </Section>
            )}

            <Section title={`Tagged evidence (${tags.length})`}>
              {!companyId ? (
                <p className="text-sm text-muted-foreground">No active company.</p>
              ) : tagsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No evidence tagged to this control yet.{" "}
                  <Link to="/evidence" className="text-primary underline" onClick={() => onOpenChange(false)}>
                    Go to Evidence
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {tags.map((t) => (
                    <div key={t.evidence_id} className="rounded border p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{t.title}</div>
                          {t.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                          )}
                          {t.storage_path && (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
                              onClick={() => downloadEvidence(t)}
                            >
                              <Download className="h-3 w-3" /> {t.storage_path.split("/").pop()}
                            </button>
                          )}
                          {!t.storage_path && (
                            <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                              <FileText className="h-3 w-3" /> no file
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => untag.mutate(t)}
                          disabled={untag.isPending}
                          title="Remove tag"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{title}</div>
      {children}
    </div>
  );
}
