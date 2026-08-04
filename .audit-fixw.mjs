import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const wid = process.argv[2];
const { error } = await sb.from('profiles').update({
  first_name:'Audit', last_name:'Rossi', full_name:'Audit Rossi', birth_date:'1995-04-12', birth_place:'Bologna',
  tax_code:'RSSDTA95D52A944F', nationality:'IT', residence_address:'Via Roma 1', residence_street:'Via Roma', residence_number:'1',
  residence_city:'Bologna', residence_postal_code:'40121', residence_province:'BO', city:'Bologna', province:'BO',
  avatar_url:'avatars/audit.jpg', phone:'+393200002999', phone_full:'+393200002999', phone_verified:true, profile_completed:true,
}).eq('id', wid);
console.log('worker profile:', error?.message ?? 'OK');
