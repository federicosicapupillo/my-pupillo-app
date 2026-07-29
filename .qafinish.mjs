import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const email = process.argv[2];
const { data: p } = await sb.from('profiles').select('*').eq('email', email).maybeSingle();
const upd = { profile_completed: true, phone_verified: true, phone_verified_at: new Date().toISOString(),
  first_name:'QA', last_name:'Avail', full_name:'QA Avail', city:'Bologna', province:'BO',
  avatar_url:'https://placehold.co/200x200.png', birth_date:'1995-05-05', age_verified:true,
  phone_country_code:'+39', phone_number:'3331234567', phone_full:'+393331234567', phone:'+393331234567' };
const { error } = await sb.from('profiles').update(upd).eq('id', p.id);
console.log('update', error?.message ?? 'ok');
