import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, MessageSquare, Settings, LogOut, Shield, Search, Plus } from "lucide-react";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    role === "restaurant" && { to: "/announcements", label: "I miei annunci", icon: Briefcase },
    role === "restaurant" && { to: "/workers", label: "Cerca lavoratori", icon: Search },
    role === "worker" && { to: "/jobs", label: "Offerte ricevute", icon: Briefcase },
    { to: "/messages", label: "Messaggi", icon: MessageSquare },
    { to: "/profile", label: "Profilo", icon: Settings },
    role === "admin" && { to: "/admin", label: "Admin", icon: Shield },
  ].filter(Boolean) as { to: string; label: string; icon: typeof LayoutDashboard }[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">P</div>
            <span className="font-semibold">Pupillo</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {items.map((i) => (
              <Link key={i.to} to={i.to as never}>
                <Button variant={loc.pathname.startsWith(i.to) ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <i.icon className="h-4 w-4" />{i.label}
                </Button>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-muted-foreground">{profile?.full_name || user?.email}</span>
            <span className="text-xs rounded-full bg-accent text-accent-foreground px-2 py-1 capitalize">{role}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <nav className="md:hidden border-t overflow-x-auto">
          <div className="flex gap-1 px-2 py-2">
            {items.map((i) => (
              <Link key={i.to} to={i.to as never}>
                <Button variant={loc.pathname.startsWith(i.to) ? "secondary" : "ghost"} size="sm" className="gap-2 whitespace-nowrap">
                  <i.icon className="h-4 w-4" />{i.label}
                </Button>
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Plus };