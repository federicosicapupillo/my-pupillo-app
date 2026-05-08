// Client-only: intercept fetch calls to TanStack Start server functions
// (`/_serverFn/...`) and inject the current Supabase access token as a
// Bearer Authorization header. Required because server fns guarded by
// `requireSupabaseAuth` read `request.headers.get('authorization')` and
// useServerFn() does not auto-forward the Supabase session.
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window { __pupilloServerFnFetchPatched?: boolean }
}

export function installServerFnAuthFetch(): void {
  if (typeof window === "undefined") return;
  if (window.__pupilloServerFnFetchPatched) return;
  window.__pupilloServerFnFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url && url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // fall through to original fetch on any error
    }
    return originalFetch(input, init);
  };
}
