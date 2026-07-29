import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const URL=process.env.SUPABASE_URL, AK=process.env.SUPABASE_PUBLISHABLE_KEY, SR=process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin=createClient(URL,SR,{auth:{persistSession:false}});
const PW='Fase4Test!2026x';
const defs=[['worker','f4.worker@pupillo.test','worker'],['restaurant','f4.rest@pupillo.test','restaurant'],['admin','f4.admin@pupillo.test','admin']];
const out={};
for (const [tag,email,role] of defs){
  const {data,error}=await admin.auth.admin.createUser({email,password:PW,email_confirm:true});
  if(error) throw new Error(tag+': '+error.message);
  const id=data.user.id;
  const base={account_status:'active', profile_completed:true, phone_verified:true, city:'Milano', province:'MI', terms_accepted:true, latitude:45.4642, longitude:9.19};
  if(role==='worker') await admin.from('profiles').update({...base, primary_role:'Cameriere', full_name:'F4 Worker', first_name:'F4', last_name:'Worker', age:30, hourly_rate:12, service_area_city:'Milano', service_area_lat:45.4642, service_area_lng:9.19}).eq('id',id);
  else await admin.from('profiles').update({...base, primary_role: role==='admin'?'admin':'restaurant', business_name: role==='admin'?null:'F4 Bistrot', full_name:'F4 '+role, vat_number:null}).eq('id',id);
  await admin.from('user_roles').insert({user_id:id, role});
  const c=createClient(URL,AK,{auth:{persistSession:false}});
  const {data:s,error:e2}=await c.auth.signInWithPassword({email,password:PW});
  if(e2) throw new Error(tag+' login: '+e2.message);
  out[tag]={id, session:s.session};
}
fs.writeFileSync('/tmp/browser/f4/sessions.json', JSON.stringify(out));
console.log('ok', Object.keys(out), 'storageKey', 'sb-'+new URL(URL).hostname.split('.')[0]+'-auth-token');
