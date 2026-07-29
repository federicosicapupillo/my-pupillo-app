import { createClient } from '@supabase/supabase-js';
const URL='https://loxgasjxsjyskyapmxke.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveGdhc2p4c2p5c2t5YXBteGtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTQyNzksImV4cCI6MjA5MzY5MDI3OX0.xCnvREq8SrpDm2CMA3lmc3KfqzNKDqJsc7ow1OgbJzM';
const admin = createClient(URL, process.env.SB_SERVICE, {auth:{persistSession:false}});
const mk = () => createClient(URL, ANON, {auth:{persistSession:false}});
const users=[];
async function mkUser(role){
  const email=`f5.${role}.${Date.now()}${Math.random().toString(36).slice(2,6)}@pupillo.test`;
  const pass='Test!12345aA';
  const {data,error}=await admin.auth.admin.createUser({email,password:pass,email_confirm:true});
  if(error) throw error;
  users.push(data.user.id);
  await admin.from('user_roles').insert({user_id:data.user.id, role: role==='admin'?'admin':role});
  await admin.from('profiles').update({email, full_name:`F5 ${role}`, phone:'+390000000', primary_role: role==='worker'?'cameriere':null, city:'Bologna', tax_code:'RSSMRA80A01H501U', credits:7}).eq('id',data.user.id);
  const c=mk(); const {error:e2}=await c.auth.signInWithPassword({email,password:pass}); if(e2) throw e2;
  return {c,id:data.user.id,email};
}
const res={};
try{
  const anon=mk();
  res.anon_profiles = await anon.from('profiles').select('id,email').limit(1).then(r=>({d:r.data,e:r.error?.code||r.error?.message}));
  res.anon_public = await anon.from('public_profiles').select('id').limit(1).then(r=>({d:r.data,e:r.error?.code||r.error?.message}));

  const w=await mkUser('worker'), r=await mkUser('restaurant'), a=await mkUser('admin');
  res.worker_own = await w.c.from('profiles').select('id,email,phone,tax_code,credits').eq('id',w.id).then(x=>({n:x.data?.length,e:x.error?.code}));
  res.worker_other = await w.c.from('profiles').select('id,email,phone,tax_code,credits,account_status').eq('id',r.id).then(x=>({n:x.data?.length,rows:x.data,e:x.error?.code}));
  res.worker_all = await w.c.from('profiles').select('id').then(x=>({n:x.data?.length,e:x.error?.code}));
  res.rest_other = await r.c.from('profiles').select('id,email,phone').eq('id',w.id).then(x=>({n:x.data?.length,e:x.error?.code}));
  res.rest_public_other = await r.c.from('public_profiles').select('id,full_name,city').eq('id',w.id).then(x=>({n:x.data?.length,e:x.error?.code}));
  res.rest_public_pii = await r.c.from('public_profiles').select('email').limit(1).then(x=>({e:x.error?.code||x.error?.message}));
  res.rest_public_pii2 = await r.c.from('public_profiles').select('phone,tax_code,id_document_path,credits').limit(1).then(x=>({e:x.error?.code}));
  res.admin_all = await a.c.from('profiles').select('id,email').then(x=>({n:x.data?.length,e:x.error?.code}));
  res.worker_update_own = await w.c.from('profiles').update({short_bio:'ok'}).eq('id',w.id).select('id').then(x=>({n:x.data?.length,e:x.error?.code}));
  res.worker_update_other = await w.c.from('profiles').update({short_bio:'hack'}).eq('id',r.id).select('id').then(x=>({n:x.data?.length,e:x.error?.code}));
  res.worker_update_credits = await w.c.from('profiles').update({credits:9999}).eq('id',w.id).select('id').then(x=>({n:x.data?.length,e:x.error?.code||x.error?.message}));
  // applications enum 400 check
  res.apps_bad = await w.c.from('applications').select('id').in('status',['accepted','confirmed','assigned']).then(x=>({e:x.error?.code||x.error?.message}));
  res.apps_ok = await w.c.from('applications').select('id').in('status',['accepted']).then(x=>({n:x.data?.length,e:x.error?.code}));
}catch(e){res.fatal=String(e);}
console.log(JSON.stringify(res,null,1));
for(const id of users){ await admin.from('user_roles').delete().eq('user_id',id); await admin.auth.admin.deleteUser(id); }
console.log('cleaned',users.length);
