import { createClient } from "@supabase/supabase-js";
const URL=process.env.SUPABASE_URL, SRK=process.env.SUPABASE_SERVICE_ROLE_KEY, PUB=process.env.SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(URL,SRK,{auth:{persistSession:false}});
const PWD="TestPasswordSicura123!";
const stamp=Date.now();
const R={};

// account "google" tecnico
const g=(await admin.auth.admin.createUser({email:`audit.google.${stamp}@pupillo-audit.test`,password:PWD,email_confirm:true})).data.user;
await admin.rpc("exec_noop").catch(()=>{});
// forza signup_method=google via SQL diretto non disponibile -> usa admin update bloccato dal trigger, quindi usiamo la funzione interna
// (il trigger consente solo ruoli di sistema): usiamo una connessione psql-like via rpc non disponibile.
// fallback: creiamo l'utente con identity google reale
const gGoogle=(await admin.auth.admin.createUser({email:`audit.google2.${stamp}@pupillo-audit.test`,email_confirm:true,user_metadata:{provider:"google"},app_metadata:{provider:"google",providers:["google"]}})).data.user;
R.created={g:g.id,gGoogle:gGoogle.id};
R.methods=(await admin.from("profiles").select("id,signup_method").in("id",[g.id,gGoogle.id])).data;

// account email/password
const e=(await admin.auth.admin.createUser({email:`audit.email.${stamp}@pupillo-audit.test`,password:PWD,email_confirm:true})).data.user;
R.email_method=(await admin.from("profiles").select("signup_method").eq("id",e.id).single()).data;

// utente senza signup_method (fail closed)
const n=(await admin.auth.admin.createUser({email:`audit.null.${stamp}@pupillo-audit.test`,password:PWD,email_confirm:true})).data.user;

async function rest(email,password){
  const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:PUB,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const j=await r.json().catch(()=>({}));
  return {status:r.status,error:j.error_code??j.error??null,msg:j.msg??j.error_description??null,has_access_token:Boolean(j.access_token),has_refresh_token:Boolean(j.refresh_token)};
}
R.rest_google_pw=await rest(gGoogle.email,PWD);      // google senza password impostata
R.rest_google_pw_set=await rest(g.email,PWD);        // "google" con password
R.rest_email_pw=await rest(e.email,PWD);
R.rest_null_pw=await rest(n.email,PWD);
R.rest_nonexistent=await rest(`nobody.${stamp}@pupillo-audit.test`,PWD);

R.hook_log=(await admin.from("auth_hook_invocations").select("user_id,signup_method,decision,created_at").order("created_at",{ascending:false}).limit(10)).data;
R.ids={g:g.id,gGoogle:gGoogle.id,e:e.id,n:n.id};
console.log(JSON.stringify(R,null,2));
