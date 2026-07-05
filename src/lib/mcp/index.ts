import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import searchAnnouncements from "./tools/search-announcements";
import myShifts from "./tools/my-shifts";
import myNotifications from "./tools/my-notifications";

// The OAuth issuer MUST be the direct Supabase host (RFC 8414 issuer match).
// Read from the Vite-inlined env; the fallback keeps the issuer well-formed
// during throwaway manifest-extract evals — a token never verifies against it.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pupillo-mcp",
  title: "Pupillo",
  version: "0.1.0",
  instructions:
    "Strumenti Pupillo (marketplace italiano di turni per ristorazione). Usa `search_announcements` per esplorare annunci pubblici, `whoami` per verificare l'utente collegato, `list_my_shifts` e `list_my_notifications` per i dati personali del lavoratore o ristoratore autenticato.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, searchAnnouncements, myShifts, myNotifications],
});