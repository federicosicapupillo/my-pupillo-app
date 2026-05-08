import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ----- Config -----
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;

function hashOtp(code: string, userId: string): string {
  // Salted with user id; sufficient for short-lived 6-digit OTP
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function genOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function sendWhatsAppMessage(phoneFull: string, code: string): Promise<{ ok: boolean; provider: string; error?: string }> {
  const provider = process.env.WHATSAPP_PROVIDER_URL || "simulated";
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Real provider integration placeholder. Wire when credentials are available.
  if (provider !== "simulated" && token && phoneNumberId) {
    try {
      // Example shape (Meta WhatsApp Cloud API). Adapt as needed.
      const res = await fetch(`${provider}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneFull.replace(/^\+/, ""),
          type: "text",
          text: {
            body: `Ciao, benvenuto su Pupillo. Il tuo codice di conferma è: ${code}. Inseriscilo nell'app per completare la registrazione.\n\nSe non hai richiesto tu questa registrazione, ignora questo messaggio.`,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, provider, error: `Provider ${res.status}: ${txt}` };
      }
      return { ok: true, provider };
    } catch (e) {
      return { ok: false, provider, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Simulation mode
  console.log(`[whatsapp:simulated] to=${phoneFull} code=${code}`);
  return { ok: true, provider: "simulated" };
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
      .neq("id", userId)
      .maybeSingle();
    if (dup) {
      return { ok: false, error: "Questo numero risulta già registrato. Accedi con il tuo account oppure usa un altro numero." };
    }

    const code = genOtp();
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
  });

// ===== VERIFY =====
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().regex(/^\d{6}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: row } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "sent"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false, error: "Nessun codice attivo. Richiedine uno nuovo." };

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("phone_verifications").update({ status: "expired" }).eq("id", row.id);
      return { ok: false, error: "Codice scaduto. Richiedine uno nuovo.", expired: true };
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
        error: attempts >= MAX_ATTEMPTS ? "Hai superato il numero massimo di tentativi." : "Codice non valido. Riprova.",
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
  });

// ===== RESEND =====
export const resendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone_country_code, phone_number")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.phone_country_code || !profile?.phone_number) {
      return { ok: false, error: "Nessun numero salvato. Inseriscilo prima." };
    }
    // Reuse start logic by calling its inner workflow
    return await startPhoneVerification({
      data: { phoneCountryCode: profile.phone_country_code, phoneNumber: profile.phone_number },
    });
  });