import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

type ControlOption = {
  id: string;
  control_ref: string;
  description: string | null;
  domain: string | null;
  parent_control_id: string | null;
};

async function fetchSecureframeOptions(): Promise<ControlOption[]> {
  const { data: fw, error: fwErr } = await supabase
    .from("frameworks")
    .select("id")
    .eq("slug", "secureframe")
    .single();
  if (fwErr) throw fwErr;
  const { data, error } = await supabase
    .from("controls")
    .select("id, control_ref, description, domain, parent_control_id")
    .eq("framework_id", fw.id)
    .order("control_ref");
  if (error) throw error;
  return data ?? [];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Currently tagged control ids for the evidence (not company_control_ids).
  selectedControlIds: Set<string>;
  onConfirm: (controlIds: string[]) => Promise<void>;
}

export function ControlPicker({ open, onOpenChange, selectedControlIds, onConfirm }: Props) {
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  // Reset draft when the dialog (re-)opens.
  useEffect(() => {
    if (open) setDraft(new Set(selectedControlIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const optionsQuery = useQuery({
    queryKey: ["sf-control-options"],
    queryFn: fetchSecureframeOptions,
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const all = optionsQuery.data ?? [];
    if (!q) return all;
    return all.filter((c) => {
      const blob = `${c.control_ref} ${c.description ?? ""} ${c.domain ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [optionsQuery.data, search]);

  function toggle(id: string) {
    setDraft((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm(Array.from(draft));
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tag controls</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search controls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="text-xs text-muted-foreground">
            {draft.size} selected · {filtered.length} shown
          </div>
          <ScrollArea className="h-96 rounded-md border">
            <div className="p-2 space-y-1">
              {optionsQuery.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No matches.</div>
              ) : (
                filtered.map((c) => {
                  const checked = draft.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{c.control_ref}</span>
                          {c.domain && <Badge variant="outline" className="text-[10px]">{c.domain}</Badge>}
                          {c.parent_control_id && <span className="text-[10px] text-muted-foreground">child</span>}
                        </div>
                        {c.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={working}>
            {working ? "Saving…" : "Save tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
