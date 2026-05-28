import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, MessageSquare, Settings, LogOut, Shield, Search, Plus, CalendarClock, Compass, Coins, Map as MapIcon, Home, ChevronRight, Users, CalendarDays } from "lucide-react";
import { PupilloMenu, PupilloClose, PupilloAvatar } from "@/components/PupilloIcons";
import { ReactNode, useRef, useState, useEffect, KeyboardEvent } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { createDebouncedReload } from "@/lib/inbox-realtime";
import pupilloLogo from "@/assets/pupillo-logo.png";
import { AssistantFab } from "@/components/assistant/AssistantFab";


export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Home dinamica in base al ruolo dell'utente
  const homeTo: string = !user
    ? "/"
    : role === "admin"
      ? "/admin"
      : "/dashboard";

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    role === "restaurant" && { to: "/announcements", label: "I miei annunci", icon: Briefcase },
    role === "restaurant" && { to: "/workers", label: "Cerca lavoratori", icon: Search },
    role === "restaurant" && { to: "/ristoratore/collaboratori", label: "Collaboratori", icon: Users },
    role === "worker" && { to: "/jobs", label: "Offerte ricevute", icon: Briefcase },
    role === "worker" && { to: "/browse", label: "Trova offerte", icon: Compass },
    role === "worker" && { to: "/availability", label: "Disponibilità", icon: CalendarDays },
    (role === "worker" || role === "restaurant") && { to: "/shifts", label: "I miei turni", icon: CalendarClock },
    (role === "worker" || role === "restaurant") && { to: "/mappa", label: "Mappa", icon: MapIcon },
    { to: "/messages", label: "Messaggi", icon: MessageSquare },
    role === "restaurant" && { to: "/billing", label: "Crediti", icon: Coins },
    { to: "/profile", label: "Profilo", icon: Settings },
    role === "admin" && { to: "/admin", label: "Admin", icon: Shield },
  ].filter(Boolean) as { to: string; label: string; icon: typeof LayoutDashboard }[];

  // Breadcrumbs basati sul path corrente
  const labelByPath: Record<string, string> = items.reduce((acc, i) => ({ ...acc, [i.to]: i.label }), {} as Record<string, string>);
  const homeLabel = role === "admin" ? "Admin" : "Dashboard";
  const segments = loc.pathname.split("/").filter(Boolean);
  const crumbs: { to: string; label: string }[] = [];
  let acc = "";
  segments.forEach((seg, idx) => {
    acc += "/" + seg;
    // salta segmenti dinamici (es. ID) per chiarezza
    if (idx > 0 && /^[0-9a-f-]{8,}$/i.test(seg)) {
      crumbs.push({ to: acc, label: "Dettaglio" });
    } else {
      crumbs.push({ to: acc, label: labelByPath[acc] || seg.charAt(0).toUpperCase() + seg.slice(1) });
    }
  });
  const showBreadcrumbs = !!user && loc.pathname !== "/" && loc.pathname !== homeTo;
  const homeIndicator = !user
    ? "Sei in Home"
    : loc.pathname === homeTo
      ? `Sei in ${homeLabel}`
      : null;

  // Focus management per il menu mobile (frecce ←/→/Home/End/Esc)
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Unread messages count (across all the user's applications)
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  useEffect(() => {
    if (!user) { setUnreadMsgs(0); return; }
    let cancelled = false;
    const load = async () => {
      const col = role === "restaurant" ? "restaurant_id" : "worker_id";
      const { data: apps } = await supabase
        .from("applications")
        .select("id")
        .eq(col, user.id);
      const ids = (apps ?? []).map((a: any) => a.id);
      if (ids.length === 0) { if (!cancelled) setUnreadMsgs(0); return; }
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("application_id", ids)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (!cancelled) setUnreadMsgs((prev) => (prev === (count ?? 0) ? prev : (count ?? 0)));
    };
    load();
    const reloader = createDebouncedReload(() => { load(); }, 300);
    const ch = supabase
      .channel(`unread-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => reloader.schedule())
      .subscribe();
    return () => { cancelled = true; reloader.cancel(); supabase.removeChannel(ch); };
  }, [user?.id, role]);

  // Chiudi automaticamente al cambio di route
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const main = typeof document !== "undefined" ? document.querySelector("main") : null;
    console.info("[PUPILLO_BLOCK_DEBUG] app_shell", {
      route_attuale: loc.pathname,
      user_id: user?.id ?? null,
      ruolo: role,
      phone_verified: profile?.phone_verified ?? null,
      profile_completion: profile?.completion_pct ?? profile?.profile_completed ?? null,
      isProfileComplete: profile?.profile_completed === true,
      isPageBlocked: false,
      motivo_blocco: null,
      disabled_buttons: [],
      disabled_by_component: null,
      overlay_active: mobileOpen,
      main_container_pointer_events_none: main ? getComputedStyle(main).pointerEvents === "none" : false,
    });
  }, [loc.pathname, user?.id, role, profile?.phone_verified, profile?.profile_completed, profile?.completion_pct, mobileOpen]);

  // Gestione globale Esc + focus sul primo link all'apertura
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // focus al primo link
    const t = setTimeout(() => {
      const first = mobileNavRef.current?.querySelector<HTMLAnchorElement>("a[href]");
      first?.focus();
    }, 50);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [mobileOpen]);

  const handleMobileNavKey = (e: KeyboardEvent<HTMLElement>) => {
    const root = mobileNavRef.current;
    if (!root) return;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"));
    if (links.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? links.indexOf(active as HTMLAnchorElement) : -1;
    const focus = (i: number) => {
      const el = links[(i + links.length) % links.length];
      el.focus();
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight": e.preventDefault(); focus(idx === -1 ? 0 : idx + 1); break;
      case "ArrowUp":
      case "ArrowLeft": e.preventDefault(); focus(idx === -1 ? 0 : idx - 1); break;
      case "Home": e.preventDefault(); focus(0); break;
      case "End": e.preventDefault(); focus(links.length - 1); break;
      case "Escape":
        e.preventDefault();
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
        break;
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[oklch(0.13_0.02_280/0.65)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <Link
            to={homeTo as never}
            aria-label="Vai alla home page"
            className="flex items-center cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-shadow"
            onKeyDown={(e) => {
              if (e.key === " " || e.code === "Space") {
                e.preventDefault();
                nav({ to: homeTo as never });
              }
            }}
          >
            <img
              src={pupilloLogo}
              alt="Logo Pupillo"
              className="h-10 w-auto object-contain md:h-12 drop-shadow-[0_0_12px_oklch(0.93_0.22_120/0.35)]"
            />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {items.map((i) => (
              <Link key={i.to} to={i.to as never}>
                <Button variant={loc.pathname.startsWith(i.to) ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <i.icon className="h-4 w-4" />{i.label}
                  {i.to === "/messages" && unreadMsgs > 0 && (
                    <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                      {unreadMsgs > 9 ? "9+" : unreadMsgs}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              ref={mobileToggleRef}
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen(o => !o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.code === "Space") {
                  e.preventDefault();
                  setMobileOpen(o => !o);
                }
              }}
            >
              {mobileOpen ? <PupilloClose size={22} /> : <PupilloMenu size={22} />}
            </Button>
            <span className="hidden sm:block text-xs text-muted-foreground">{profile?.full_name || user?.email}</span>
            {role && (
              <span className="hidden sm:inline-flex text-[10px] rounded-full bg-accent text-accent-foreground px-2 py-1 capitalize">{role}</span>
            )}
            {role === "restaurant" && (
              <Link to="/billing" title="Saldo crediti">
                <span className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/10 text-primary px-2 py-1 font-medium hover:bg-primary/20 transition-colors">
                  <Coins className="h-3.5 w-3.5" />
                  {profile?.credits ?? 0}
                </span>
              </Link>
            )}
            {user && <NotificationBell />}
            <ThemeToggle />
            {user && (
              <Link
                to="/profile"
                aria-label="Vai al profilo"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <PupilloAvatar name={profile?.full_name} email={user.email} />
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
        <nav
          ref={mobileNavRef}
          id="mobile-nav"
          hidden={!mobileOpen}
          className="md:hidden border-t overflow-x-auto"
          aria-label="Menu di navigazione"
          onKeyDown={handleMobileNavKey}
        >
          <div role="menubar" aria-orientation="vertical" className="flex flex-col gap-1 px-2 py-2">
            {items.map((i) => {
              const isActive = loc.pathname.startsWith(i.to);
              return (
                <Link
                  key={i.to}
                  to={i.to as never}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => setMobileOpen(false)}
                >
                  <Button variant={isActive ? "secondary" : "ghost"} size="sm" tabIndex={-1} className="w-full justify-start gap-2 whitespace-nowrap">
                    <i.icon className="h-4 w-4" />{i.label}
                    {i.to === "/messages" && unreadMsgs > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                        {unreadMsgs > 9 ? "9+" : unreadMsgs}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      {(showBreadcrumbs || homeIndicator) && (
        <div className="border-b border-white/5 bg-[oklch(0.13_0.02_280/0.4)] backdrop-blur-md">
          <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 py-2 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Link
              to={homeTo as never}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Home className="h-3.5 w-3.5" />
              <span>{!user ? "Home" : homeLabel}</span>
            </Link>
            {homeIndicator && (
              <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                {homeIndicator}
              </span>
            )}
            {showBreadcrumbs && crumbs.map((c, i) => (
              <span key={c.to + i} className="inline-flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="text-foreground font-medium">{c.label}</span>
                ) : (
                  <Link to={c.to as never} className="hover:text-foreground transition-colors">{c.label}</Link>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">{children}</main>
      <AssistantFab />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Plus };