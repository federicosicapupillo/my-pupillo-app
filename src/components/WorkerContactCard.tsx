import { useEffect, useState } from "react";
import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface WorkerContactCardProps {
  workerId: string;
  restaurantId: string;
  workerName?: string;
}

export function WorkerContactCard({
  workerId,
  restaurantId,
  workerName,
}: WorkerContactCardProps) {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPhone() {
      try {
        const { data, error } = await supabase.rpc("get_counterparty_phone", {
          other_user_id: workerId,
        });

        if (cancelled) return;

        if (error) {
          console.error("RPC get_counterparty_phone error:", error);
          setPhone(null);
        } else {
          setPhone(data as string | null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Unexpected error fetching phone:", err);
        setPhone(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPhone();

    return () => {
      cancelled = true;
    };
  }, [workerId]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm animate-pulse">
        <div className="h-5 w-48 bg-muted rounded mb-3" />
        <div className="h-4 w-full bg-muted rounded mb-2" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    );
  }

  if (phone === null || phone === undefined || phone === "") {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground font-semibold mb-1">
          <Phone className="h-4 w-4" />
          <span>Contatti lavoratore</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Numero di telefono non disponibile.
        </p>
        <p className="text-sm text-muted-foreground">
          Il lavoratore non lo ha ancora inserito nel profilo.
        </p>
      </div>
    );
  }

  const waNumber = phone.replace(/[^0-9]/g, "");

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
        <Phone className="h-4 w-4" />
        <span>Contatti lavoratore</span>
      </div>

      {workerName && (
        <p className="text-sm text-foreground mb-1">{workerName}</p>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        Telefono: {phone}
      </p>

      <div className="flex gap-2">
        <Button asChild variant="default" size="sm">
          <a href={`tel:${phone}`}>
            <Phone className="h-4 w-4 mr-1.5" />
            Chiama
          </a>
        </Button>

        <Button asChild variant="outline" size="sm">
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
