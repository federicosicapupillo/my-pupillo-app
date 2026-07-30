import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RID='6d42c60a-5222-43e1-a245-704ac3f74091';
const { data, error } = await sb.from('profiles').update({ business_name:'Trattoria E2E Test', phone:'+393200000999', contact_person_first_name:'Mario', contact_person_last_name:'Test', city:'Bologna' }).eq('id',RID).select('business_name,phone,city,contact_person_first_name');
console.log(JSON.stringify({data,error}));
