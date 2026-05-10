import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/lib/active-company";

const SECUREFRAME_SLUG = "secureframe";

type DashboardStats = {
  totalControls: number;
  parentControls: number;
  childControls: number;
  controlsWithEvidence: number;
  evidenceCount: number;
  totalTags: number;
  recommendationsOpen: number;
  soc2Total: number;
  soc2Covered: number;
};

async function fetchStats(companyId: string): Promise<DashboardStats> {
  // 1. Secureframe controls (catalog)
  const { data: fw } = await supabase
    .from("frameworks")
    .select("id")
    .eq("slug", SECUREFRAME_SLUG)
    .single();
  if (!fw) {
    throw new Error("Secureframe framework not found");
  }
  const { data: controls } = await supabase
    .from("controls")
    .select("id, parent_control_id")
    .eq("framework_id", fw.id);
  const totalControls = controls?.length ?? 0;
  const parentControls = controls?.filter((c) => !c.parent_control_id).length ?? 0;
  const childControls = totalControls - parentControls;

  // 2. Per-company tagged controls (each company_controls row that has any
  // evidence_controls entry counts as "with evidence").
  const { data: companyControls } = await supabase
    .from("company_controls")
    .select("control_id, evidence_controls(evidence_id)")
    .eq("company_id", companyId);
  const tagged = (companyControls ?? []).filter((cc) => (cc.evidence_controls?.length ?? 0) > 0);
  const controlsWithEvidence = tagged.length;
  const totalTags = (companyControls ?? []).reduce(
    (acc, cc) => acc + (cc.evidence_controls?.length ?? 0),
    0,
  );

  // 3. Evidence count
  const { count: evidenceCount } = await supabase
    .from("evidence")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  // 4. Open recommendations
  const { count: recommendationsOpen } = await supabase
    .from("recommendations")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", ["open", "in_progress"]);

  // 5. SOC 2 coverage — count distinct SOC 2 controls reachable from tagged
  // Secureframe controls via direct/effective crosswalks.
  const { data: soc2Fw } = await supabase
    .from("frameworks")
    .select("id")
    .eq("slug", "soc2")
    .single();
  let soc2Total = 0;
  let soc2Covered = 0;
  if (soc2Fw) {
    const { count: total } = await supabase
      .from("controls")
      .select("*", { count: "exact", head: true })
      .eq("framework_id", soc2Fw.id);
    soc2Total = total ?? 0;

    const taggedControlIds = tagged.map((t) => t.control_id);
    if (taggedControlIds.length > 0) {
      const { data: cws } = await supabase
        .from("crosswalks")
        .select("target_control_id, target:controls!crosswalks_target_control_id_fkey(framework_id)")
        .in("source_control_id", taggedControlIds)
        .in("mapping_type", ["direct", "effective"]);
      const covered = new Set<string>();
      for (const cw of cws ?? []) {
        type CW = { target_control_id: string; target: { framework_id: string } | null };
        const c = cw as CW;
        if (c.target?.framework_id === soc2Fw.id) covered.add(c.target_control_id);
      }
      soc2Covered = covered.size;
    }
  }

  return {
    totalControls,
    parentControls,
    childControls,
    controlsWithEvidence,
    evidenceCount: evidenceCount ?? 0,
    totalTags,
    recommendationsOpen: recommendationsOpen ?? 0,
    soc2Total,
    soc2Covered,
  };
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { activeCompany } = useActiveCompany();

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", activeCompany?.id],
    queryFn: () => fetchStats(activeCompany!.id),
    enabled: !!activeCompany,
  });

  if (!activeCompany) {
    return (
      <Layout>
        <PageHeader
          title="Dashboard"
          description="Pick a company in the sidebar — or create one — to see workspace-specific metrics."
          actions={
            <Button asChild size="sm">
              <Link to="/companies">Create Company</Link>
            </Button>
          }
        />
      </Layout>
    );
  }

  const s = statsQuery.data;
  const missing = s ? Math.max(0, s.totalControls - s.controlsWithEvidence) : 0;
  const soc2Missing = s ? Math.max(0, s.soc2Total - s.soc2Covered) : 0;

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description={`Workspace: ${activeCompany.name}`}
      />

      {statsQuery.isLoading || !s ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat
              label="Secureframe Controls"
              value={s.totalControls}
              hint={`${s.parentControls} parent · ${s.childControls} child`}
            />
            <Stat label="Controls w/ Evidence" value={s.controlsWithEvidence} />
            <Stat label="Controls Missing Evidence" value={missing} />
            <Stat label="Open Recommendations" value={s.recommendationsOpen} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Evidence Items" value={s.evidenceCount} />
            <Stat label="Total Mappings" value={s.totalTags} />
            <Stat
              label="SOC 2 Criteria Covered"
              value={s.soc2Covered}
              hint={`of ${s.soc2Total} via direct/effective`}
            />
            <Stat label="SOC 2 Criteria Missing" value={soc2Missing} />
          </div>
        </>
      )}
    </Layout>
  );
}
