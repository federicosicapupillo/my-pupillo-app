import { createFileRoute } from "@tanstack/react-router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^([0-9a-f-]{36})\/(?:avatar-\d+|moderated\/[0-9a-f-]{36})\.(jpe?g|png|webp)$/i;

/**
 * Indirizzo stabile della foto profilo (usato dall'Academy e salvato nell'account di accesso).
 * Non scade: a ogni richiesta reindirizza a un link firmato breve della foto approvata.
 * Restituisce solo l'immagine, nessun altro dato.
 */
export const Route = createFileRoute("/api/public/avatar/$userId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.userId;
        if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url, is_deleted, moderation_hidden")
          .eq("id", id)
          .maybeSingle();
        const path = data?.avatar_url ?? null;
        const m = path ? PATH_RE.exec(path) : null;
        if (!data || data.is_deleted || data.moderation_hidden || !m || m[1] !== id) {
          return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
        }
        const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(path!, 600);
        if (!signed?.signedUrl) return new Response("Unavailable", { status: 503 });
        return new Response(null, { status: 302, headers: { location: signed.signedUrl, "cache-control": "public, max-age=300" } });
      },
    },
  },
});
