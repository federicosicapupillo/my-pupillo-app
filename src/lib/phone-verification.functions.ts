import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isContactPhoneLocked } from "@/lib/contact-verification";

// Compatibility names retained for existing callers. Cloud Auth owns OTP generation,
// expiry, throttling and one-time consumption. No test bypass or phone validation.
export const startPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    phoneCountryCode: z.string().regex(/^\+\d{1,4}$/),
    phoneNumber: z.string().regex(/^\d{6,15}$/),
    sendSummary: z.boolean().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const user = identity.user;
    if (identityError || !user?.email || user.id !== context.userId) return { ok: false, error: "Email dell’account non disponibile." };
    const { data: profile, error: profileError } = await context.supabase.rpc("get_my_profile");
    if (profileError || !profile || profile.is_deleted || profile.deleted_at) return { ok: false, error: "Profilo non disponibile." };
    const phoneFull = `${data.phoneCountryCode}${data.phoneNumber}`;
    if (isContactPhoneLocked(profile) && phoneFull !== (profile.phone_full || profile.phone)) {
      return { ok: false, error: "Il numero di cellulare non può essere modificato dopo la conferma del codice." };
    }
    const { error: saveError } = await context.supabase.rpc("update_my_profile" as never, { _patch: {
      phone_country_code: data.phoneCountryCode, phone_number: data.phoneNumber, phone_full: phoneFull, phone: phoneFull,
    } } as never);
    if (saveError) return { ok: false, error: saveError.message };
    const { error } = await context.supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
    if (error) return { ok: false, error: "Non siamo riusciti a inviare il codice via email. Riprova tra un minuto.", cooldownSeconds: 60 };
    return { ok: true, simulated: false, provider: "email", email: user.email };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().regex(/^\d{6,8}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const user = identity.user;
    if (identityError || !user?.email || user.id !== context.userId) return { ok: false, error: "Email dell’account non disponibile." };
    const { data: verified, error } = await context.supabase.auth.verifyOtp({ email: user.email, token: data.code, type: "email" });
    if (error || verified.user?.id !== context.userId || verified.user.email !== user.email) return { ok: false, error: "Codice non valido o scaduto. Richiedi un nuovo codice.", expired: false, maxedOut: false };
    // Privileged write is only reached after Cloud Auth consumed a real OTP
    // for this authenticated user's current account email.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error: saveError } = await supabaseAdmin.from("profiles").update({
      email_otp_verified_at: new Date().toISOString(),
      contact_phone_locked_at: new Date().toISOString(),
      email_otp_verified_address: user.email,
    }).eq("id", context.userId).eq("email", user.email).eq("is_deleted", false).is("deleted_at", null).select("id").maybeSingle();
    if (saveError || !saved) return { ok: false, error: "Non siamo riusciti a salvare la verifica. Richiedi un nuovo codice." };
    return { ok: true, email: user.email };
  });

export const resendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: identity, error: identityError } = await context.supabase.auth.getUser();
    const user = identity.user;
    if (identityError || !user?.email || user.id !== context.userId) return { ok: false, error: "Email dell’account non disponibile." };
    const { data: profile } = await context.supabase.rpc("get_my_profile");
    if (!profile || profile.is_deleted || profile.deleted_at || !profile.phone_full) return { ok: false, error: "Inserisci prima il numero di cellulare." };
    const { error } = await context.supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
    if (error) return { ok: false, error: "Reinvio non riuscito. Riprova tra un minuto.", cooldownSeconds: 60 };
    return { ok: true, simulated: false, provider: "email" };
  });
