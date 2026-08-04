import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthMethods, type AuthMethods, type IdentityLike } from "@/lib/auth-methods";

type State = {
  methods: AuthMethods | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

/**
 * Carica le identità reali dell'utente (fonte autorevole:
 * `supabase.auth.getUserIdentities()`), con fallback su `user.identities`.
 */
export function useAuthMethods(): State {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) throw userErr ?? new Error("no user");
      const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;

      let identities: IdentityLike[] | null = null;
      const res = await supabase.auth.getUserIdentities();
      if (!res.error && res.data?.identities) identities = res.data.identities;
      else identities = (userData.user.identities ?? null) as IdentityLike[] | null;

      setMethods(getAuthMethods(identities, meta));
    } catch {
      setMethods(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { methods, loading, error, refresh: load };
}
