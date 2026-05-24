import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});

const { data: workers } = await sb.from('profiles').select('id').like('email', 'lavoratore.d%@pupillo.test');
const { data: rests } = await sb.from('profiles').select('id').like('email', 'ristoratore.d%@pupillo.test');
console.log('workers', workers?.length, 'restaurants', rests?.length);

let rep=0;
for (const w of workers||[]) {
  const { error } = await sb.rpc('recompute_worker_reputation', { _worker: w.id });
  if (!error) rep++;
}
console.log('reputation recomputed:', rep);

const allIds = [...(workers||[]).map(x=>x.id), ...(rests||[]).map(x=>x.id)];
const { count: notifCount } = await sb.from('notifications').select('*', { count:'exact', head:true}).in('user_id', allIds);
const { count: annCount } = await sb.from('announcements').select('*', { count:'exact', head:true}).eq('is_demo', true);
const { count: appCount } = await sb.from('applications').select('*', { count:'exact', head:true}).eq('is_demo', true);
const { count: shiftCount } = await sb.from('shifts').select('*', { count:'exact', head:true}).eq('is_demo', true);
const { count: revCount } = await sb.from('reviews').select('*', { count:'exact', head:true}).eq('is_demo', true);
console.log({ notifications: notifCount, announcements: annCount, applications: appCount, shifts: shiftCount, reviews: revCount });

// Test login
const sb2 = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: loginData, error: loginErr } = await sb2.auth.signInWithPassword({ email: 'lavoratore.d001@pupillo.test', password: 'Test1234!' });
console.log('login test:', loginErr ? loginErr.message : 'OK ' + loginData.user.email);
