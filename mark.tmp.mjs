import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ids = process.argv.slice(2);
for (const [i,id] of ids.entries()) {
  const { error } = await sb.from('profiles').update({
    phone: '+39320000010'+i, phone_full: '+39320000010'+i, phone_country_code:'+39', phone_number:'320000010'+i,
    phone_verified: true, phone_verified_at: new Date().toISOString(), profile_completed: true,
  }).eq('id', id);
  console.log(id, error?.message || 'ok');
}
