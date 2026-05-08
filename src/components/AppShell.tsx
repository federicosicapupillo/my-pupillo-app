import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Briefcase, MessageSquare, Settings, LogOut, Shield, Search, Plus, CalendarClock, Compass, Coins, Map as MapIcon, Home, ChevronRight, Menu, X } from "lucide-react";
import { ReactNode, useRef, useState, useEffect, KeyboardEvent } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import pupilloLogo from "@/assets/pupillo-logo.png";


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
    role === "worker" && { to: "/jobs", label: "Offerte ricevute", icon: Briefcase },
    role === "worker" && { to: "/browse", label: "Trova offerte", icon: Compass },
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

  const initials = (profile?.full_name || user?.email || "U")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Focus management per il menu mobile (frecce ←/→/Home/End/Esc)
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Chiudi automaticamente al cambio di route
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

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
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-3">
          <Link
            to={homeTo as never}
            aria-label="Vai alla home page"
            className="flex items-center gap-2 shrink-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all hover:opacity-90"
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
              className="h-9 w-auto object-contain md:h-10"
            />
            <span className="hidden sm:inline-block font-semibold tracking-tight text-base bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Pupillo
            </span>
          </Link>
          <nav aria-label="Navigazione principale" className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 shadow-sm">
              {items.map((i) => {
                const isActive = loc.pathname === i.to || (i.to !== "/" && loc.pathname.startsWith(i.to + "/")) || loc.pathname === i.to;
                return (
                  <Link
                    key={i.to}
                    to={i.to as never}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                    }`}
                  >
                    <i.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                    <span className="whitespace-nowrap">{i.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="flex items-center gap-1.5 ml-auto">
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
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            {role === "restaurant" && (
              <Link to="/billing" title="Saldo crediti" className="hidden sm:inline-flex">
                <span className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold hover:bg-primary/20 transition-colors">
                  <Coins className="h-3.5 w-3.5" />
                  {profile?.credits ?? 0}
                </span>
              </Link>
            )}
            {user && <NotificationBell />}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Menu account"
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 pl-1 pr-2.5 py-1 hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={(profile as { avatar_url?: string } | null)?.avatar_url || undefined} alt="" />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-accent text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline-block text-xs font-medium capitalize text-muted-foreground">{role}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="text-sm font-medium truncate">{profile?.full_name || user.email}</span>
                    <span className="text-xs text-muted-foreground capitalize">{role}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav({ to: "/profile" })}>
                    <Settings className="h-4 w-4 mr-2" /> Profilo
                  </DropdownMenuItem>
                  {role === "restaurant" && (
                    <DropdownMenuItem onClick={() => nav({ to: "/billing" })}>
                      <Coins className="h-4 w-4 mr-2" /> Crediti ({profile?.credits ?? 0})
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await signOut(); nav({ to: "/" }); }}>
                    <LogOut className="h-4 w-4 mr-2" /> Esci
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
        <nav
          ref={mobileNavRef}
          id="mobile-nav"
          hidden={!mobileOpen}
          className="md:hidden border-t bg-background/95 backdrop-blur"
          aria-label="Menu di navigazione"
          onKeyDown={handleMobileNavKey}
        >
          <div role="menubar" aria-orientation="vertical" className="flex flex-col gap-1 px-3 py-3">
            {items.map((i) => {
              const isActive = loc.pathname.startsWith(i.to);
              return (
                <Link
                  key={i.to}
                  to={i.to as never}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <i.icon className="h-4 w-4 shrink-0" />
                  <span>{i.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      {(showBreadcrumbs || homeIndicator) && (
        <div className="border-b bg-muted/40">
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