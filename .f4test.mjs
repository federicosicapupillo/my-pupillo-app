import { createClient } from '@supabase/supabase-js';
const URL=process.env.SUPABASE_URL, AK=process.env.SUPABASE_PUBLISHABLE_KEY, SR=process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin=createClient(URL,SR,{auth:{persistSession:false}});
const PW='Fase4Test!2026x';
const users={};
async function mk(tag,email,role){
  const {data,error}=await admin.auth.admin.createUser({email,password:PW,email_confirm:true});
  if(error) throw error;
  await admin.from('profiles').update({primary_role: role==='restaurant'?'restaurant':'worker', account_status:'active', full_name:'F4 '+tag, city:'Milano'}).eq('id',data.user.id);
  await admin.from('user_roles').insert({user_id:data.user.id, role: role==='admin'?'admin':role});
  users[tag]={id:data.user.id,email};
  return data.user.id;
}
await mk('worker','f4.worker@pupillo.test','worker');
await mk('rest','f4.rest@pupillo.test','restaurant');
await mk('admin','f4.admin@pupillo.test','admin');
async function tok(tag){const c=createClient(URL,AK,{auth:{persistSession:false}});const {data,error}=await c.auth.signInWithPassword({email:users[tag].email,password:PW});if(error)throw error;return data.session.access_token;}
const T={anon:null,worker:await tok('worker'),restaurant:await tok('rest'),admin:await tok('admin')};
async function req(role,path,init={}){
  const h={apikey:AK,'Content-Type':'application/json',...(T[role]?{Authorization:'Bearer '+T[role]}:{}),...(init.headers||{})};
  const r=await fetch(URL+path,{...init,headers:h});
  const t=await r.text();
  return {status:r.status, body:t.slice(0,180)};
}
const out=[];
for(const role of ['anon','worker','restaurant','admin']){
  out.push([role,'public_profiles select pubblico',await req(role,'/rest/v1/public_profiles?select=id,full_name,approx_lat,approx_lng,rating_avg&limit=2')]);
  out.push([role,'public_profiles select phone (deve fallire)',await req(role,'/rest/v1/public_profiles?select=phone&limit=1')]);
  out.push([role,'public_profiles select email (deve fallire)',await req(role,'/rest/v1/public_profiles?select=email&limit=1')]);
  out.push([role,'rpc recompute_worker_reputation (deve fallire)',await req(role,'/rest/v1/rpc/recompute_worker_reputation',{method:'POST',body:JSON.stringify({_worker:users.worker.id})})]);
  out.push([role,'profiles select email altrui',await req(role,'/rest/v1/profiles?select=id,email&id=eq.'+users.worker.id)]);
}
for(const [r,t,v] of out) console.log(`${r.padEnd(11)} | ${t.padEnd(45)} | ${v.status} | ${v.body.replace(/\s+/g,' ')}`);
// approx precision check
const {data:ap}=await admin.from('public_profiles').select('approx_lat,approx_lng').not('approx_lat','is',null).limit(3);
console.log('approx sample', JSON.stringify(ap));
// cleanup
for(const k of Object.keys(users)){ await admin.auth.admin.deleteUser(users[k].id); }
console.log('cleanup done');
