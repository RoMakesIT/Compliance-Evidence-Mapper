import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ControlOption = {
  id: string;
  control_ref: string;
  description: string | null;
  domain: string | null;
  parent_control_id: string | null;
  evidence_keywords: string | null;
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
    .select("id, control_ref, description, domain, parent_control_id, evidence_keywords")
    .eq("framework_id", fw.id)
    .order("control_ref");
  if (error) throw error;
  return data ?? [];
}

const STOP = new Set([
  "the","and","for","with","that","this","from","into","your","you","are","was","were","have","has","had",
  "any","all","not","but","its","their","our","its","also","can","will","may","via","per","upon","such",
  "about","over","each","other","when","then","than","they","them","there","which","while","both",
]);

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

function controlTokens(c: ControlOption): Set<string> {
  // Keywords are the strongest signal; description fills in when keywords
  // are sparse or missing.
  const keywordTokens = (c.evidence_keywords ?? "")
    .split(/[;,]/)
    .flatMap((k) => k.split(/\s+/));
  const set = new Set<string>();
  for (const t of keywordTokens) {
    const norm = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm.length >= 4 && !STOP.has(norm)) set.add(norm);
  }
  for (const t of tokenize(c.description)) set.add(t);
  return set;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Currently tagged control ids for the evidence (not company_control_ids).
  selectedControlIds: Set<string>;
  onConfirm: (controlIds: string[]) => Promise<void>;
  // Free-text describing the evidence — title, description, filename. Used
  // only to compute keyword-overlap suggestions; pass an empty string to
  // disable suggestions.
  evidenceText?: string;
}

export function ControlPicker({
  open,
  onOpenChange,
  selectedControlIds,
  onConfirm,
  evidenceText = "",
}: Props) {
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  // Reset draft and search when the dialog (re-)opens.
  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedControlIds));
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const optionsQuery = useQuery({
    queryKey: ["sf-control-options"],
    queryFn: fetchSecureframeOptions,
    enabled: open,
  });

  const evTokens = useMemo(() => tokenize(evidenceText), [evidenceText]);

  // Score every control by keyword overlap with the evidence text.
  const scored = useMemo(() => {
    const all = optionsQuery.data ?? [];
    if (evTokens.size === 0) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const c of all) {
      const ct = controlTokens(c);
      let score = 0;
      for (const t of evTokens) if (ct.has(t)) score += 1;
      if (score > 0) m.set(c.id, score);
    }
    return m;
  }, [optionsQuery.data, evTokens]);

  const all = optionsQuery.data ?? [];
  const q = search.toLowerCase().trim();

  const matchesSearch = (c: ControlOption) => {
    if (!q) return true;
    const blob = `${c.control_ref} ${c.description ?? ""} ${c.domain ?? ""} ${c.evidence_keywords ?? ""}`.toLowerCase();
    return blob.includes(q);
  };

  // When searching, just filter. When not searching and we have suggestions,
  // split into Suggested + All so the operator's eye lands on likely matches.
  const SUGGEST_TOP = 8;
  const showSuggestions = !q && scored.size > 0;
  const suggested = showSuggestions
    ? all
        .filter((c) => scored.has(c.id))
        .sort((a, b) => (scored.get(b.id)! - scored.get(a.id)!) || a.control_ref.localeCompare(b.control_ref))
        .slice(0, SUGGEST_TOP)
    : [];
  const suggestedIds = new Set(suggested.map((c) => c.id));
  const rest = all.filter((c) => matchesSearch(c) && !suggestedIds.has(c.id));

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

  function row(c: ControlOption, score?: number) {
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
            {score !== undefined && score > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                <Sparkles className="h-3 w-3" /> {score}
              </span>
            )}
          </div>
          {c.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
          )}
        </div>
      </label>
    );
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
            {draft.size} selected
            {showSuggestions && ` · ${suggested.length} suggested by keywords`}
          </div>
          <ScrollArea className="h-96 rounded-md border">
            <div className="p-2 space-y-1">
              {optionsQuery.isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <>
                  {showSuggestions && (
                    <>
                      <div className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Suggested
                      </div>
                      {suggested.map((c) => row(c, scored.get(c.id)))}
                      <div className="px-2 pt-3 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        All controls
                      </div>
                    </>
                  )}
                  {rest.length === 0 && !showSuggestions ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No matches.</div>
                  ) : (
                    rest.map((c) => row(c, scored.get(c.id)))
                  )}
                </>
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
