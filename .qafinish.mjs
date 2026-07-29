import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const email = process.argv[2];
const { data: p, error } = await sb.from('profiles').select('*').eq('email', email).maybeSingle();
if (error) { console.log('err', error.message); process.exit(1); }
console.log('profile keys sample', p && Object.keys(p).filter(k=>/complete|phone|verif|city|first|last|birth/.test(k)));
const upd = { profile_completed: true, phone_verified: true, first_name:'QA', last_name:'Avail', full_name:'QA Avail', city:'Bologna', province:'BO' };
const { error: e2 } = await sb.from('profiles').update(upd).eq('id', p.id);
console.log('update', e2?.message ?? 'ok');
