import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Share2, Coins, Users, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Invite = {
  id: string;
  referred_user_id: string | null;
  referred_email: string | null;
  status: "pending" | "registered" | "verified" | "completed" | "rejected";
  credits_awarded: boolean;
  credits_amount: number;
  created_at: string;
  completed_at: string | null;
};

export function ReferralCard() {
  const { profile, user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const code = (profile as any)?.referral_code as string | undefined;
  const earned = (profile as any)?.referral_credits_earned ?? 0;

  const link = typeof window !== "undefined" && code
    ? `${window.location.origin}/auth?role=worker&ref=${encodeURIComponent(code)}`
    : "";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("referral_invites")
        .select("id, referred_user_id, referred_email, status, credits_awarded, credits_amount, created_at, completed_at")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setInvites((data as any) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiato negli appunti.`);
    } catch {
      toast.error("Impossibile copiare. Copia manualmente.");
    }
  };

  const shareWa = () => {
    const msg = `Ti invito su Pupillo, l'app per turni Horeca! Usa il mio codice ${code} o registrati con questo link: ${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const completed = invites.filter(i => i.status === "completed").length;
  const pending = invites.filter(i => i.status !== "completed" && i.status !== "rejected").length;

  if (!code) return null;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Presenta un amico</h2>
            <p className="text-sm text-muted-foreground">Invita un amico su Pupillo e guadagna 5 crediti quando completa la registrazione.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Il tuo codice</div>
          <div className="flex gap-2">
            <Input readOnly value={code} className="font-mono" />
            <Button variant="outline" size="icon" onClick={() => copy(code, "Codice")} aria-label="Copia codice">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Link personale</div>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(link, "Link")} aria-label="Copia link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={shareWa} className="gap-2">
          <Share2 className="h-4 w-4" /> Condividi su WhatsApp
        </Button>
        <Button variant="outline" onClick={() => copy(link, "Link")} className="gap-2">
          <Copy className="h-4 w-4" /> Copia link
        </Button>
      </div>

      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Stat icon={Coins} label="Crediti guadagnati" value={earned} />
        <Stat icon={Users} label="Amici invitati" value={invites.length} />
        <Stat icon={CheckCircle2} label="Completati" value={completed} />
        <Stat icon={Clock} label="In attesa" value={pending} />
      </div>

      {invites.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-medium mb-2">Storico</div>
          <ul className="divide-y rounded-lg border">
            {invites.slice(0, 8).map(i => (
              <li key={i.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{i.referred_email ?? "Amico invitato"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString("it-IT")}</div>
                </div>
                <StatusBadge status={i.status} awarded={i.credits_awarded} amount={i.credits_amount} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && invites.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nessun invito ancora. Condividi il tuo codice per iniziare!</p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status, awarded, amount }: { status: Invite["status"]; awarded: boolean; amount: number }) {
  if (status === "completed" && awarded) {
    return <span className="text-xs rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5">+{amount} crediti</span>;
  }
  if (status === "rejected") {
    return <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5">Rifiutato</span>;
  }
  return <span className="text-xs rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5">In attesa</span>;
}
