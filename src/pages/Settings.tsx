import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveCompany } from "@/lib/active-company";

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, default_company_id, created_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { activeCompany, companies } = useActiveCompany();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  const [displayName, setDisplayName] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the input once the profile loads.
  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      setDisplayName(profileQuery.data.display_name ?? "");
      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  async function saveProfile() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast({ title: "Profile saved" });
  }

  return (
    <Layout>
      <PageHeader title="Settings" description="Account, workspace, and app info." />

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-medium">Account</h3>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveProfile} disabled={profileQuery.isLoading}>
                Save profile
              </Button>
              <Button variant="outline" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <h3 className="text-sm font-medium">Active workspace</h3>
            {activeCompany ? (
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{activeCompany.name}</span>
                </div>
                {activeCompany.industry && (
                  <div>
                    <span className="text-muted-foreground">Industry:</span> {activeCompany.industry}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Your role:</span>{" "}
                  <Badge variant="secondary">{activeCompany.role}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {companies.length} workspace{companies.length === 1 ? "" : "s"} total. Switch in the sidebar.
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active workspace.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <h3 className="text-sm font-medium">Backend</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium text-foreground">Supabase:</span>{" "}
                <code className="text-[11px]">{import.meta.env.VITE_SUPABASE_URL}</code>
              </div>
              <div>
                Storage bucket: <code className="text-[11px]">evidence</code> (path:{" "}
                <code className="text-[11px]">{`{company_id}/{evidence_id}/{filename}`}</code>)
              </div>
              <div>
                Local backups: run <code className="text-[11px]">./bin/backup.sh</code> or use the
                Backup app.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
