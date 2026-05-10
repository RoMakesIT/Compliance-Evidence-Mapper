import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type CompanyMembership = Tables<"companies"> & { role: Enums<"company_role"> };

interface ActiveCompanyCtx {
  loading: boolean;
  companies: CompanyMembership[];
  activeCompany: CompanyMembership | null;
  setActiveCompanyId: (id: string | null) => void;
  refetch: () => void;
}

const Ctx = createContext<ActiveCompanyCtx | null>(null);

const storageKey = (userId: string) => `ecm.activeCompany.${userId}`;

async function fetchMemberships(userId: string): Promise<CompanyMembership[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("role, company:companies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const out: CompanyMembership[] = [];
  for (const r of data ?? []) if (r.company) out.push({ ...r.company, role: r.role });
  return out;
}

export function ActiveCompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["companies", user?.id],
    queryFn: () => fetchMemberships(user!.id),
    enabled: !!user,
  });

  // Hydrate active id from localStorage when the user changes.
  useEffect(() => {
    if (!user) {
      setActiveIdState(null);
      return;
    }
    setActiveIdState(localStorage.getItem(storageKey(user.id)));
  }, [user]);

  // If active id isn't in the membership list (or is null and there's exactly
  // one company), pick the first available.
  useEffect(() => {
    const list = query.data ?? [];
    if (!user || list.length === 0) return;
    const stillValid = activeId && list.some((c) => c.id === activeId);
    if (!stillValid) {
      const first = list[0].id;
      setActiveIdState(first);
      localStorage.setItem(storageKey(user.id), first);
    }
  }, [query.data, user, activeId]);

  const setActiveCompanyId = (id: string | null) => {
    setActiveIdState(id);
    if (user) {
      if (id) localStorage.setItem(storageKey(user.id), id);
      else localStorage.removeItem(storageKey(user.id));
    }
  };

  const value = useMemo<ActiveCompanyCtx>(() => {
    const companies = query.data ?? [];
    const activeCompany = companies.find((c) => c.id === activeId) ?? null;
    return {
      loading: query.isLoading,
      companies,
      activeCompany,
      setActiveCompanyId,
      refetch: () => void query.refetch(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isLoading, activeId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveCompany() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveCompany must be used within ActiveCompanyProvider");
  return ctx;
}
