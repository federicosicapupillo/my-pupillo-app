import { createClient } from "@supabase/supabase-js";
const URL=process.env.SUPABASE_URL, SRK=process.env.SUPABASE_SERVICE_ROLE_KEY, PUB=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(URL,SRK,{auth:{persistSession:false}});
const anonC=()=>createClient(URL,PUB,{auth:{persistSession:false}});
const R={};
const G_ID="37e29f81-43c4-485e-975a-0ce2b216acf0"; // account google-like creato nel test 1
const gEmail=(await admin.auth.admin.getUserById(G_ID)).data.user.email;

// hook: account google
R.hook_google = (await admin.rpc("password_verification_hook",{event:{user_id:G_ID,valid:true}})).data;
// hook: account email reale
const emailUser=(await admin.from("profiles").select("id").eq("signup_method","email").limit(1).single()).data;
R.hook_email = (await admin.rpc("password_verification_hook",{event:{user_id:emailUser.id,valid:true}})).data;
// hook: user_id sconosciuto / assente => fail closed
R.hook_unknown = (await admin.rpc("password_verification_hook",{event:{user_id:"00000000-0000-0000-0000-000000000000"}})).data;
R.hook_missing = (await admin.rpc("password_verification_hook",{event:{}})).data;

// immutabilità signup_method via service_role REST
R.rest_service_role_update = (await admin.from("profiles").update({signup_method:"email"}).eq("id",G_ID)).error?.message ?? "CONSENTITO";

// come utente autenticato (google-like): RPC + REST
const c=anonC();
await c.auth.signInWithPassword({email:gEmail,password:"TestPasswordSicura123!"});
R.rpc_my_signup_method = (await c.rpc("my_signup_method")).data;
R.rest_self_update = (await c.from("profiles").update({signup_method:"email"}).eq("id",G_ID)).error?.message ?? "CONSENTITO";
R.rpc_update_my_profile = (await c.rpc("update_my_profile",{_patch:{signup_method:"email"}})).error?.message ?? "CONSENTITO";
// utente estraneo
R.rest_other_user = (await c.from("profiles").update({signup_method:"google"}).eq("id",emailUser.id)).error?.message ?? "CONSENTITO";
// anon
R.anon_hook = (await anonC().rpc("password_verification_hook",{event:{user_id:G_ID}})).error?.message ?? "CONSENTITO";
R.anon_my_signup = (await anonC().rpc("my_signup_method")).error?.message ?? "CONSENTITO";

console.log(JSON.stringify(R,null,2));
