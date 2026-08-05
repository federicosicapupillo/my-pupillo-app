import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthMethods,
  getOriginalSignupMethod,
  type AuthMethods,
  type IdentityLike,
  type SignupMethod,
} from "@/lib/auth-methods";

type State = {
  methods: AuthMethods | null;
  /** Metodo con cui l'account è stato creato (fonte canonica). */
  signupMethod: SignupMethod | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

/**
 * Carica le identità reali dell'utente (fonte autorevole:
 * `supabase.auth.getUserIdentities()`), con fallback su `user.identities`.
 */
export function useAuthMethods(profile?: { signup_method?: unknown } | null): State {
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [signupMethod, setSignupMethod] = useState<SignupMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const profileSignupMethod = profile?.signup_method ?? null;

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
      setSignupMethod(
        getOriginalSignupMethod(
          {
            app_metadata: (userData.user.app_metadata ?? {}) as Record<string, unknown>,
            identities,
          },
          { signup_method: profileSignupMethod },
        ),
      );
    } catch {
      setMethods(null);
      setSignupMethod(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profileSignupMethod]);

  useEffect(() => { void load(); }, [load]);

  return { methods, signupMethod, loading, error, refresh: load };
}
