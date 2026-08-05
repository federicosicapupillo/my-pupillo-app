import { createClient } from "@supabase/supabase-js";
const URL = process.env.SUPABASE_URL, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY, PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL, SRK, { auth: { persistSession: false } });
const anonC = () => createClient(URL, PUB, { auth: { persistSession: false } });
const email = `audit.google.${Date.now()}@pupillo-audit.test`;
const P1 = "InitialPass123!", P2 = "TestPasswordSicura123!";
const out = {};

// 1) crea utente "social-like": lo creiamo con provider email + password iniziale
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password: P1, email_confirm: true, app_metadata: { provider: "google", providers: ["google"] } });
out.create = ce?.message ?? cu.user.id;
const uid = cu?.user?.id;
// forza signup_method google sul profilo
const { error: pe } = await admin.from("profiles").update({ signup_method: "google" }).eq("id", uid);
out.profileUpdate = pe?.message ?? "ok";

// 2) login con password iniziale
const c = anonC();
const { data: s1, error: se } = await c.auth.signInWithPassword({ email, password: P1 });
out.initialLogin = se?.message ?? "ok";

// 3) chiamata diretta updateUser
const { data: up, error: ue } = await c.auth.updateUser({ password: P2 });
out.updateUser = ue ? { code: ue.code, status: ue.status, message: ue.message } : "SUCCESS";

// 4) identità dopo
const { data: idn } = await c.auth.getUserIdentities();
out.identities = (idn?.identities ?? []).map(i => i.provider);

// 5) login con nuova password
const c2 = anonC();
const { error: le } = await c2.auth.signInWithPassword({ email, password: P2 });
out.loginWithNewPassword = le ? { code: le.code, status: le.status, message: le.message } : "SUCCESS";

console.log(JSON.stringify({ uid, email, ...out }, null, 2));
