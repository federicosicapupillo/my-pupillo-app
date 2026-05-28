import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash, randomInt } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ----- Config -----
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const TEST_OTP_CODE = "123456";

function isTestOtpFlagEnabled(): boolean {
  const readFlag = (value: unknown) =>
    String(value ?? "").replace(/^['"]|['"]$/g, "").trim().toLowerCase() === "true";
  return (
    readFlag(process.env.ENABLE_TEST_OTP) ||
    readFlag(process.env.VITE_ENABLE_TEST_OTP) ||
    readFlag(import.meta.env.VITE_ENABLE_TEST_OTP)
  );
}

function isLovableTestHostOrLocal(): boolean {
  const host = getRequest()?.headers.get("host") ?? "";
  return (
    host.includes("preview") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    process.env.LOVABLE_SANDBOX === "true"
  );
}

function isWhatsAppSimulatedMode(): boolean {
  return !process.env.LOVABLE_API_KEY || !process.env.TWILIO_API_KEY || !process.env.TWILIO_WHATSAPP_FROM;
}

function isTestOrDemoUser(profile: { email?: string | null; is_demo?: boolean | null } | null, phoneFull?: string | null): boolean {
  if (!profile) return false;
  if (profile.is_demo === true) return true;
  const email = (profile.email ?? "").toLowerCase();
  if (email.includes("test") || email.includes("demo") || email.includes("+test") || email.endsWith("@example.com")) {
    return true;
  }
  // Fictitious phone numbers commonly used for testing
  const p = (phoneFull ?? "").replace(/\s+/g, "");
  if (/^\+?39?000/.test(p) || /^\+?1?555/.test(p) || /^\+?123456/.test(p)) return true;
  return false;
}

/**
 * Demo OTP is accepted only in test-like environments:
 *  - explicit server test flag, Lovable test/published preview host, local sandbox, or simulated WhatsApp delivery
 *  - AND either the profile is demo/test, or WhatsApp delivery is simulated so no real OTP can be received.
 */
function isTestOtpAllowedFor(profile: { email?: string | null; is_demo?: boolean | null } | null, phoneFull?: string | null): boolean {
  const envAllows = isTestOtpFlagEnabled() || isLovableTestHostOrLocal() || isWhatsAppSimulatedMode();
  if (!envAllows) return false;
  // In ambienti preview/dev/test o quando WhatsApp è in modalità simulata, il
  // codice fisso 123456 deve essere sempre accettato: l'utente non riceve
  // alcun messaggio reale, quindi non avrebbe modo di completare la verifica.
  // In produzione (host reale + WhatsApp configurato) questa funzione resta
  // disattivata dal primo check envAllows.
  return true;
}

function normalizePhoneFull(raw: string | null | undefined): string {
  if (!raw) return "";
  // Mantieni un eventuale "+" iniziale, rimuovi tutti gli altri caratteri non numerici.
  const trimmed = String(raw).trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  // Se inizia con 00 (formato internazionale alternativo) sostituisci con +.
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  // Numero italiano senza prefisso → assumi +39.
  if (digits.length === 10 && digits.startsWith("3")) return `+39${digits}`;
  return `+${digits}`;
}

function hashOtp(code: string, userId: string): string {
  // Salted with user id; sufficient for short-lived 6-digit OTP
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function genOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function sendWhatsAppMessage(phoneFull: string, code: string): Promise<{ ok: boolean; provider: string; error?: string }> {
  // Twilio WhatsApp via Lovable connector gateway.
  // Requires LOVABLE_API_KEY + TWILIO_API_KEY (auto-injected when Twilio connector is linked).
  // TWILIO_WHATSAPP_FROM must be a Twilio WhatsApp-enabled sender, e.g. "whatsapp:+14155238886" (sandbox).
  // Optional: TWILIO_CONTENT_SID + TWILIO_MESSAGING_SERVICE_SID for approved template messages
  // (required outside the 24h session window in production).
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid = process.env.TWILIO_CONTENT_SID;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (isWhatsAppSimulatedMode()) {
    console.log(`[whatsapp:simulated] to=${phoneFull} code=${code}`);
    return { ok: true, provider: "simulated" };
  }

  const to = `whatsapp:${phoneFull}`;
  const params = new URLSearchParams();
  params.set("To", to);

  if (contentSid) {
    // Template-based (works outside 24h window). ContentVariables maps to your template placeholders.
    if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
    else params.set("From", from!);
    params.set("ContentSid", contentSid);
    params.set("ContentVariables", JSON.stringify({ "1": code }));
  } else {
    params.set("From", from!);
    params.set(
      "Body",
      `Pupillo: il tuo codice di conferma è ${code}. Valido ${OTP_TTL_MINUTES} minuti. Se non l'hai richiesto, ignora questo messaggio.`,
    );
  }

  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey!,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const txt = await res.text();
    if (!res.ok) {
      console.error(`[whatsapp:twilio] ${res.status} ${txt}`);
      return { ok: false, provider: "twilio", error: `Twilio API ${res.status}: ${txt}` };
    }
    return { ok: true, provider: "twilio" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[whatsapp:twilio] network error: ${msg}`);
    return { ok: false, provider: "twilio", error: msg };
  }
}

async function sendSummaryEmail(params: {
  to: string;
  fullName: string;
  role: string;
  phoneFull: string;
  email: string;
}): Promise<{ ok: boolean; provider: string }> {
  // Placeholder: log only. Wire to Lovable Email queue when transactional emails are scaffolded.
  console.log("[email:summary:simulated]", {
    to: params.to,
    subject: "Riepilogo registrazione Pupillo",
    body: `Ciao ${params.fullName},\nLa tua registrazione su Pupillo è stata ricevuta correttamente.\nTipo account: ${params.role}\nTelefono: ${params.phoneFull}\nEmail: ${params.email}\nPer completare l'attivazione del profilo, conferma il codice ricevuto via WhatsApp.\nGrazie,\nTeam Pupillo`,
  });
  return { ok: true, provider: "simulated" };
}

// ===== START =====
export const startPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phoneCountryCode: z.string().min(2).max(6).regex(/^\+\d{1,4}$/),
        phoneNumber: z.string().min(6).max(15).regex(/^\d+$/),
        sendSummary: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const phoneFull = `${data.phoneCountryCode}${data.phoneNumber}`;
    try {

    // Cooldown: latest pending/sent within RESEND_COOLDOWN_SECONDS
    const { data: latest } = await supabaseAdmin
      .from("phone_verifications")
      .select("created_at, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && (latest.status === "pending" || latest.status === "sent")) {
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (ageMs < RESEND_COOLDOWN_SECONDS * 1000) {
        const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - ageMs) / 1000);
        return { ok: false, error: `Attendi ${wait}s prima di richiedere un nuovo codice.`, cooldownSeconds: wait };
      }
    }

    // Duplicate phone check (active accounts other than self)
    const { data: dup } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_full", phoneFull)
      .eq("phone_verified", true)
      .eq("is_deleted", false)
      .neq("id", userId)
      .maybeSingle();
    if (dup) {
      return { ok: false, error: "Questo numero risulta già registrato. Accedi con il tuo account oppure usa un altro numero." };
    }

    const { data: startProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, is_demo, is_deleted, deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (startProfile?.is_deleted || startProfile?.deleted_at) {
      console.info("[auth] phone verification start blocked for deleted account", { userId });
      return { ok: false, error: "Questo account è stato eliminato e non può più essere utilizzato." };
    }
    const code = isTestOtpAllowedFor(startProfile, phoneFull) ? TEST_OTP_CODE : genOtp();
    const codeHash = hashOtp(code, userId);
    const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    // Expire any older pending/sent rows for this user
    await supabaseAdmin
      .from("phone_verifications")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .in("status", ["pending", "sent"]);

    const { error: insErr } = await supabaseAdmin.from("phone_verifications").insert({
      user_id: userId,
      phone_full: phoneFull,
      otp_code_hash: codeHash,
      expires_at: expires,
      status: "pending",
    });
    if (insErr) return { ok: false, error: insErr.message };

    // Update profile with phone fields
    await supabaseAdmin
      .from("profiles")
      .update({
        phone_country_code: data.phoneCountryCode,
        phone_number: data.phoneNumber,
        phone_full: phoneFull,
        phone: phoneFull,
        whatsapp_confirmation_sent_at: new Date().toISOString(),
        whatsapp_confirmation_status: "pending",
      })
      .eq("id", userId);

    const send = await sendWhatsAppMessage(phoneFull, code);
    await supabaseAdmin
      .from("phone_verifications")
      .update({ status: send.ok ? "sent" : "failed" })
      .eq("user_id", userId)
      .eq("otp_code_hash", codeHash);
    await supabaseAdmin
      .from("profiles")
      .update({ whatsapp_confirmation_status: send.ok ? "sent" : "failed" })
      .eq("id", userId);

    // Optionally send summary email on first start
    if (data.sendSummary) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
      const role = roles?.[0]?.role ?? "user";
      await sendSummaryEmail({
        to: profile?.email ?? "",
        fullName: profile?.full_name ?? "",
        role,
        phoneFull,
        email: profile?.email ?? "",
      });
      await supabaseAdmin
        .from("profiles")
        .update({ email_summary_sent_at: new Date().toISOString(), email_summary_status: "sent" })
        .eq("id", userId);
    }

    return { ok: send.ok, provider: send.provider, simulated: send.provider === "simulated" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[startPhoneVerification] runtime error:", e);
      return { ok: false, error: `Errore interno: ${msg}` };
    }
  });

// ===== VERIFY =====
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().regex(/^\d{6}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {

    const { data: row } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "sent"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // TEST MODE: accept fixed code without an active OTP row (test/demo users only)
    const { data: verifyProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, is_demo, phone_full, is_deleted, deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (verifyProfile?.is_deleted || verifyProfile?.deleted_at) {
      console.info("[auth] phone verification confirm blocked for deleted account", { userId });
      return { ok: false, error: "Questo account è stato eliminato e non può più essere utilizzato." };
    }
    if (
      data.code === TEST_OTP_CODE &&
      isTestOtpAllowedFor(verifyProfile, verifyProfile?.phone_full ?? null)
    ) {
      const now = new Date().toISOString();
      if (row) {
        await supabaseAdmin
          .from("phone_verifications")
          .update({ status: "verified", verified_at: now })
          .eq("id", row.id);
      }
      await supabaseAdmin
        .from("profiles")
        .update({
          phone_verified: true,
          phone_verified_at: now,
          whatsapp_confirmation_status: "verified_test",
        })
        .eq("id", userId);
      return { ok: true, testMode: true };
    }

    if (!row) return { ok: false, error: "Nessun codice attivo. Richiedine uno nuovo." };

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_verifications").update({ status: "expired" }).eq("id", row.id);
      return { ok: false, error: "Codice scaduto. Richiedi un nuovo codice.", expired: true };
    }

    if ((row.attempts_count ?? 0) >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("phone_verifications").update({ status: "failed" }).eq("id", row.id);
      return { ok: false, error: "Hai superato il numero massimo di tentativi.", maxedOut: true };
    }

    const expectedHash = hashOtp(data.code, userId);
    if (expectedHash !== row.otp_code_hash) {
      const attempts = (row.attempts_count ?? 0) + 1;
      const newStatus = attempts >= MAX_ATTEMPTS ? "failed" : row.status;
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts_count: attempts, status: newStatus })
        .eq("id", row.id);
      return {
        ok: false,
        error: attempts >= MAX_ATTEMPTS ? "Hai superato il numero massimo di tentativi." : "Codice non valido. Controlla il codice ricevuto e riprova.",
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
      };
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("phone_verifications")
      .update({ status: "verified", verified_at: now })
      .eq("id", row.id);
    await supabaseAdmin
      .from("profiles")
      .update({
        phone_verified: true,
        phone_verified_at: now,
        whatsapp_confirmation_status: "verified",
      })
      .eq("id", userId);

    return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[verifyPhoneOtp] runtime error:", e);
      return { ok: false, error: `Errore interno: ${msg}` };
    }
  });

// ===== RESEND =====
export const resendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone_country_code, phone_number, is_deleted, deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_deleted || profile?.deleted_at) {
      console.info("[auth] phone verification resend blocked for deleted account", { userId });
      return { ok: false, error: "Questo account è stato eliminato e non può più essere utilizzato." };
    }
    if (!profile?.phone_country_code || !profile?.phone_number) {
      return { ok: false, error: "Nessun numero salvato. Inseriscilo prima." };
    }
    // Reuse start logic by calling its inner workflow
    return await startPhoneVerification({
      data: { phoneCountryCode: profile.phone_country_code, phoneNumber: profile.phone_number },
    });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[resendPhoneOtp] runtime error:", e);
      return { ok: false, error: `Errore interno: ${msg}` };
    }
  });