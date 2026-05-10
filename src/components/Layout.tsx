import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  FileText,
  ClipboardCheck,
  Lightbulb,
  GitCompare,
  Settings,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/controls", label: "Controls", icon: ShieldCheck },
  { to: "/evidence", label: "Evidence", icon: FileText },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { to: "/crosswalk", label: "Crosswalk", icon: GitCompare },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { companies, activeCompanyId, setActiveCompanyId } = useStore();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b">
          <div className="font-semibold text-base leading-tight">Evidence Control Mapper</div>
          <div className="text-xs text-muted-foreground mt-0.5">SOC 2 · Internal</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Active Company</div>
          <Select
            value={activeCompanyId ?? ""}
            onValueChange={(v) => setActiveCompanyId(v || null)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No companies yet</div>
              )}
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
