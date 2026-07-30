import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const RID='6d42c60a-5222-43e1-a245-704ac3f74091';
for (const pass of [1,2]) {
  const { data, error } = await sb.rpc('process_restaurant_account_deletion', { _uid: RID });
  console.log('pass', pass, JSON.stringify(data), error?.message||'');
}
