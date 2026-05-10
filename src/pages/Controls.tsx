import { Fragment, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";

export default function Controls() {
  const { controls, mappings, activeCompanyId, importControls } = useStore();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [type, setType] = useState("all");
  const [soc2, setSoc2] = useState("all");
  const [evState, setEvState] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const evidenceCountByControl = useMemo(() => {
    const m = new Map<string, number>();
    mappings
      .filter(
        (x) =>
          (!activeCompanyId || x.company_id === activeCompanyId) &&
          (x.mapping_status === "Approved" || x.mapping_status === "Manual"),
      )
      .forEach((x) => m.set(x.control_id, (m.get(x.control_id) || 0) + 1));
    return m;
  }, [mappings, activeCompanyId]);

  const domains = useMemo(() => Array.from(new Set(controls.map((c) => c.domain))).sort(), [controls]);
  const soc2List = useMemo(() => {
    const s = new Set<string>();
    controls.forEach((c) =>
      c.soc2_effective_mapping
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => s.add(x)),
    );
    return Array.from(s).sort();
  }, [controls]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return controls.filter((c) => {
      if (domain !== "all" && c.domain !== domain) return false;
      if (type === "parent" && c.parent_control_code) return false;
      if (type === "child" && !c.parent_control_code) return false;
      if (soc2 !== "all" && !c.soc2_effective_mapping.includes(soc2)) return false;
      const has = (evidenceCountByControl.get(c.id) || 0) > 0;
      if (evState === "has" && !has) return false;
      if (evState === "missing" && has) return false;
      if (q) {
        const blob = `${c.control_code} ${c.description} ${c.domain} ${c.cis_ig1_mapping}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [controls, search, domain, type, soc2, evState, evidenceCountByControl]);

  // Group: parents first with their matched children inline
  const parents = filtered.filter((c) => !c.parent_control_code);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, typeof controls>();
    controls
      .filter((c) => c.parent_control_code)
      .forEach((c) => {
        if (!m.has(c.parent_control_code)) m.set(c.parent_control_code, []);
        m.get(c.parent_control_code)!.push(c);
      });
    return m;
  }, [controls]);

  // Orphan children (parent filtered out) – show flat
  const visibleParentCodes = new Set(parents.map((p) => p.control_code));
  const orphans = filtered.filter((c) => c.parent_control_code && !visibleParentCodes.has(c.parent_control_code));

  function toggle(code: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  function statusBadge(controlId: string) {
    const count = evidenceCountByControl.get(controlId) || 0;
    if (count === 0) return <Badge variant="outline">No evidence</Badge>;
    return <Badge>{count} mapped</Badge>;
  }

  function exportCoverage() {
    const rows = controls.map((c) => ({
      "Control Code": c.control_code,
      "Parent Code": c.parent_control_code,
      Domain: c.domain,
      "Control Type": c.control_type,
      Description: c.description,
      "SOC 2 Effective": c.soc2_effective_mapping,
      "Evidence Count": evidenceCountByControl.get(c.id) || 0,
      Status: (evidenceCountByControl.get(c.id) || 0) > 0 ? "Has Evidence" : "Missing Evidence",
    }));
    downloadCSV("control-coverage.csv", rows);
  }

  async function reimport() {
    const n = await importControls();
    toast({ title: "Controls reimported", description: `${n} controls loaded` });
  }

  return (
    <Layout>
      <PageHeader
        title="Controls Library"
        description={`${controls.length} controls from sanitized Secureframe-derived SOC 2 catalog.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reimport}>
              <RefreshCw className="h-4 w-4" /> Reimport
            </Button>
            <Button size="sm" onClick={exportCoverage}>
              Export Coverage
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input
            placeholder="Search code, description, CIS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {domains.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="parent">Parent only</SelectItem>
              <SelectItem value="child">Child only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={soc2} onValueChange={setSoc2}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SOC 2</SelectItem>
              {soc2List.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={evState} onValueChange={setEvState}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All evidence states</SelectItem>
              <SelectItem value="has">Has evidence</SelectItem>
              <SelectItem value="missing">Missing evidence</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-28">Code</TableHead>
              <TableHead className="w-40">Domain</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">SOC 2 Effective</TableHead>
              <TableHead className="w-32">CIS IG1</TableHead>
              <TableHead className="w-32">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parents.map((p) => {
              const kids = childrenByParent.get(p.control_code) || [];
              const isOpen = expanded.has(p.control_code);
              return (
                <FragmentWithKey key={p.id}>
                  <TableRow className="font-medium">
                    <TableCell>
                      {kids.length > 0 && (
                        <button onClick={() => toggle(p.control_code)} className="p-0.5">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.control_code}</TableCell>
                    <TableCell>{p.domain}</TableCell>
                    <TableCell className="text-sm">{p.description}</TableCell>
                    <TableCell>
                      <SocBadges value={p.soc2_effective_mapping} direct={p.soc2_direct_mapping} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.cis_ig1_mapping || "—"}</TableCell>
                    <TableCell>{statusBadge(p.id)}</TableCell>
                  </TableRow>
                  {isOpen &&
                    kids.map((k) => (
                      <TableRow key={k.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell className="font-mono text-xs pl-6 text-muted-foreground">{k.control_code}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{k.domain}</TableCell>
                        <TableCell className="text-sm">{k.description}</TableCell>
                        <TableCell>
                          <SocBadges value={k.soc2_effective_mapping} direct={k.soc2_direct_mapping} inherited={k.soc2_inherited_mapping} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{k.cis_ig1_mapping || "—"}</TableCell>
                        <TableCell>{statusBadge(k.id)}</TableCell>
                      </TableRow>
                    ))}
                </FragmentWithKey>
              );
            })}
            {orphans.map((c) => (
              <TableRow key={c.id}>
                <TableCell></TableCell>
                <TableCell className="font-mono text-xs">{c.control_code}</TableCell>
                <TableCell>{c.domain}</TableCell>
                <TableCell className="text-sm">{c.description}</TableCell>
                <TableCell>
                  <SocBadges value={c.soc2_effective_mapping} direct={c.soc2_direct_mapping} inherited={c.soc2_inherited_mapping} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.cis_ig1_mapping || "—"}</TableCell>
                <TableCell>{statusBadge(c.id)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Layout>
  );
}

function SocBadges({ value, direct, inherited }: { value: string; direct?: string; inherited?: string }) {
  const items = value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => {
        const isDirect = direct && direct.includes(s);
        const isInherited = !isDirect && inherited && inherited.includes(s);
        return (
          <Badge
            key={s}
            variant={isInherited ? "outline" : "secondary"}
            title={isDirect ? "Direct mapping" : isInherited ? "Inherited from parent" : ""}
          >
            {s}
          </Badge>
        );
      })}
    </div>
  );
}
