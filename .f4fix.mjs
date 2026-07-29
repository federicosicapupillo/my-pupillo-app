import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const a=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const S=JSON.parse(fs.readFileSync('/tmp/browser/f4/sessions.json','utf8'));
const common={profile_completed:true, phone_verified:true, age_verified:true, terms_accepted:true, account_status:'active', city:'Milano', province:'MI'};
const jobs=[
 [S.worker.id,{...common, phone_full:'+393330000001', birth_date:'1994-01-01', first_name:'F4', last_name:'Worker', full_name:'F4 Worker', primary_role:'Cameriere', avatar_url:'https://example.com/a.png', hourly_rate:12, service_area_city:'Milano', service_area_lat:45.4642, service_area_lng:9.19}],
 [S.restaurant.id,{...common, phone_full:'+393330000002', full_name:'F4 Rest', business_name:'F4 Bistrot', primary_role:'restaurant', latitude:45.4642, longitude:9.19}],
 [S.admin.id,{...common, phone_full:'+393330000003', full_name:'F4 Admin', primary_role:'admin'}],
];
for(const [id,patch] of jobs){
  const {error}=await a.from('profiles').update(patch).eq('id',id);
  console.log(id, error? 'ERR '+error.message : 'ok');
}
const {data}=await a.from('profiles').select('id,email,profile_completed,phone_verified').in('id',jobs.map(j=>j[0]));
console.log(data);
