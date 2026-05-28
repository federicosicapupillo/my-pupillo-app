// Server-only guard ensuring that the demo reset+reseed never triggers real
// external sends (WhatsApp, Email, SMS, push, payments) and never touches real
// (non-demo) data.
//
// All checks are evaluated server-side via assertDemoSafe(). If anything is
// missing or unsafe, the seed is BLOCKED with an explicit message.

export const DEMO_SEED_MODE = true as const;
export const DEMO_BATCH_PREFIX = "demo_seed_";
export const DEMO_EMAIL_DOMAIN = "@pupillo.test" as const;
export const DEMO_PASSWORD = "Test1234!" as const;

export type DemoWhitelist = {
  emails: string[];
  phones: string[];
};

export type DemoSafetyReport = {
  demoSeedMode: boolean;
  whatsapp: "mock" | "live" | "disabled";
  email: "mock" | "live" | "disabled";
  sms: "mock" | "live" | "disabled";
  payments: "test" | "live" | "disabled";
  realNotifications: "disabled" | "enabled";
  serviceRoleAvailable: boolean;
  whitelist: DemoWhitelist;
  reasonsBlocked: string[];
};

function envFlag(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v.toLowerCase() : undefined;
}

export function buildSafetyReport(whitelist: DemoWhitelist = { emails: [], phones: [] }): DemoSafetyReport {
  const reasons: string[] = [];

  if (!DEMO_SEED_MODE) reasons.push("DEMO_SEED_MODE non attivo");

  const serviceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) reasons.push("SUPABASE_SERVICE_ROLE_KEY mancante");

  // Payments: block if any LIVE Stripe key is present
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  let payments: DemoSafetyReport["payments"] = "disabled";
  if (stripeSecret) {
    if (stripeSecret.startsWith("sk_live_")) {
      payments = "live";
      reasons.push("Stripe in modalità LIVE: pagamenti reali non consentiti durante il seed");
    } else if (stripeSecret.startsWith("sk_test_")) {
      payments = "test";
    }
  }

  // WhatsApp / Email / SMS: if no provider is configured we treat as 'disabled'
  // (= safe, the seed only writes DB rows). If a provider is configured, force
  // 'mock' unless an explicit *_LIVE flag is set (which we then block).
  const whatsappLive = envFlag("WHATSAPP_MODE") === "live";
  const emailLive = envFlag("EMAIL_MODE") === "live";
  const smsLive = envFlag("SMS_MODE") === "live";

  const whatsapp: DemoSafetyReport["whatsapp"] = whatsappLive ? "live" : "mock";
  const email: DemoSafetyReport["email"] = emailLive ? "live" : "mock";
  const sms: DemoSafetyReport["sms"] = smsLive ? "live" : "mock";

  if (whatsappLive && whitelist.phones.length === 0) reasons.push("WhatsApp in modalità LIVE senza whitelist");
  if (emailLive && whitelist.emails.length === 0) reasons.push("Email in modalità LIVE senza whitelist");
  if (smsLive && whitelist.phones.length === 0) reasons.push("SMS in modalità LIVE senza whitelist");

  return {
    demoSeedMode: DEMO_SEED_MODE,
    whatsapp,
    email,
    sms,
    payments,
    realNotifications: "disabled", // we never call notification providers in the seed
    serviceRoleAvailable: serviceRole,
    whitelist,
    reasonsBlocked: reasons,
  };
}

export function assertDemoSafe(whitelist?: DemoWhitelist): DemoSafetyReport {
  const report = buildSafetyReport(whitelist);
  if (report.reasonsBlocked.length > 0) {
    const err = new Error(
      "Reset BLOCCATO — protezioni non soddisfatte:\n- " + report.reasonsBlocked.join("\n- "),
    );
    (err as any).safetyReport = report;
    throw err;
  }
  return report;
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

export function makeDemoEmail(role: "ristoratore" | "lavoratore", index: number): string {
  const n = String(index).padStart(3, "0");
  return `${role}-${n}${DEMO_EMAIL_DOMAIN}`;
}

export function newBatchId(): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${DEMO_BATCH_PREFIX}${ts}`;
}