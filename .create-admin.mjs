import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb.auth.admin.createUser({
  email: 'admin.reset@pupillo.test',
  password: 'Test1234!',
  email_confirm: true,
  phone: '+390000000000',
  phone_confirm: true,
  user_metadata: { full_name: 'Admin Reset', role: 'admin' }
});
if (error) { console.error('ERR createUser:', error.message); process.exit(1); }
const uid = data.user.id;
console.log('Admin created:', uid);

// handle_new_user trigger created profile + user_role=worker (default fallback). Force admin role.
const { error: rErr } = await sb.from('user_roles').upsert({ user_id: uid, role: 'admin' }, { onConflict: 'user_id,role' });
if (rErr) console.error('role upsert:', rErr.message);
await sb.from('user_roles').delete().eq('user_id', uid).neq('role', 'admin');

const { error: pErr } = await sb.from('profiles').update({
  first_name: 'Admin',
  last_name: 'Reset',
  full_name: 'Admin Reset',
  primary_role: 'admin',
  phone_full: '+390000000000',
  phone_verified: true,
  phone_verified_at: new Date().toISOString(),
  account_status: 'active',
}).eq('id', uid);
if (pErr) console.error('profile update:', pErr.message);

await sb.from('activity_logs').insert({
  user_id: uid,
  action: 'admin.total_reset',
  entity_type: 'system',
  metadata: { note: 'Reset totale Pupillo eseguito, nuovo admin di emergenza creato.' }
});

console.log('DONE. Admin email: admin.reset@pupillo.test / password: Test1234!');
