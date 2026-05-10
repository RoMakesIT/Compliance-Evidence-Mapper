import { useMemo } from "react";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
  const { controls, evidence, mappings, recommendations, companies, activeCompanyId } = useStore();

  const company = companies.find((c) => c.id === activeCompanyId);
  const myEvidence = useMemo(
    () => (activeCompanyId ? evidence.filter((e) => e.company_id === activeCompanyId) : []),
    [evidence, activeCompanyId],
  );
  const myMappings = useMemo(
    () => (activeCompanyId ? mappings.filter((m) => m.company_id === activeCompanyId) : []),
    [mappings, activeCompanyId],
  );

  const parentCount = controls.filter((c) => !c.parent_control_code).length;
  const childCount = controls.filter((c) => c.parent_control_code).length;

  const approved = myMappings.filter((m) => m.mapping_status === "Approved" || m.mapping_status === "Manual");
  const controlsWithEvidence = new Set(approved.map((m) => m.control_id));
  const controlsMissing = controls.length - controlsWithEvidence.size;
  const needingReview = myMappings.filter((m) => m.mapping_status === "Suggested" || m.mapping_status === "Needs Review").length;

  const soc2Covered = new Set<string>();
  approved.forEach((m) => {
    const c = controls.find((x) => x.id === m.control_id);
    c?.soc2_effective_mapping
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => soc2Covered.add(s));
  });

  const allSoc2 = new Set<string>();
  controls.forEach((c) =>
    c.soc2_effective_mapping
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => allSoc2.add(s)),
  );
  const soc2Missing = allSoc2.size - soc2Covered.size;

  const recsReady = recommendations.filter(
    (r) => r.company_id === activeCompanyId && (r.status === "Reviewed" || r.status === "Included in Report"),
  ).length;

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description={
          company
            ? `Workspace: ${company.name}`
            : "Select or create a company workspace to see company-specific metrics."
        }
        actions={
          !company && (
            <Button asChild size="sm">
              <Link to="/companies">Create Company</Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Controls" value={controls.length} hint={`${parentCount} parent · ${childCount} child`} />
        <Stat label="Controls w/ Evidence" value={controlsWithEvidence.size} />
        <Stat label="Controls Missing Evidence" value={controlsMissing} />
        <Stat label="Recommendations Ready" value={recsReady} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Evidence Items" value={myEvidence.length} />
        <Stat label="Needing Review" value={needingReview} />
        <Stat label="SOC 2 Criteria Covered" value={soc2Covered.size} hint={`of ${allSoc2.size}`} />
        <Stat label="SOC 2 Criteria Missing" value={soc2Missing} />
      </div>

      {!company && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Create a company workspace to begin uploading evidence.
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
