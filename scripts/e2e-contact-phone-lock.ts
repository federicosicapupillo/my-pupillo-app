import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'node:fs/promises';

const url = process.env['SUPABASE_URL'];
const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
if (!url || !secret || !key) throw new Error('Missing test configuration');
const admin = createClient(url, secret, { auth: { persistSession: false } });
const created: string[] = [];
const stamp = Date.now();
function assert(condition: boolean, name: string) {
  if (!condition) throw new Error(name);
  console.log(`PASS ${name}`);
}

try {
  for (const role of ['worker', 'restaurant']) {
    const email = `e2e-phone-lock-${role}-${stamp}@example.com`;
    const password = crypto.randomUUID();
    const { data: account, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role } });
    if (error || !account.user) throw new Error('Test user creation failed');
    const id = account.user.id;
    created.push(id);
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError || !auth.session) throw new Error('Test sign-in failed');
    const initial = { phone: '+393331234567', phone_full: '+393331234567', phone_number: '3331234567', phone_country_code: '+39' };
    const { error: beforeError } = await client.rpc('update_my_profile', { _patch: initial });
    assert(!beforeError, `${role}: contact editable before OTP`);
    // Fixture represents an already-successful email OTP; never bypasses the OTP handler.
    const { error: fixtureError } = await admin.from('profiles').update({ email_otp_verified_at: new Date().toISOString(), email_otp_verified_address: email, contact_phone_locked_at: new Date().toISOString() }).eq('id', id);
    assert(!fixtureError, `${role}: confirmed email fixture saved`);
    for (const [field, value] of Object.entries({ phone: '+393339999999', phone_full: '+393339999999', phone_number: '3339999999', phone_country_code: '+44' })) {
      const { error: editError } = await client.rpc('update_my_profile', { _patch: { [field]: value } });
      assert(!!editError, `${role}: ${field} immutable after email OTP`);
    }
    const { error: unchangedError } = await client.rpc('update_my_profile', { _patch: { ...initial, first_name: 'Test', last_name: 'Lock' } });
    assert(!unchangedError, `${role}: other profile data saves with unchanged phone`);
    const { error: unlockError } = await client.rpc('update_my_profile', { _patch: { contact_phone_locked_at: null } });
    assert(!!unlockError, `${role}: owner cannot clear phone lock`);
    if (role === 'worker') {
      await mkdir('/tmp/browser/phone-lock', { recursive: true });
      await writeFile('/tmp/browser/phone-lock/session.json', JSON.stringify({ storage_key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, userId: id }));
    }
    const { data: profile } = await client.rpc('get_my_profile');
    assert(profile?.phone_full === initial.phone_full && profile.phone_verified === false && !!profile.contact_phone_locked_at, `${role}: number persisted without claiming phone verification`);
    const { error: emailError } = await admin.from('profiles').update({ email: `changed-${email}` }).eq('id', id);
    assert(!emailError, `${role}: authorized email change fixture saved`);
    const { error: afterEmailError } = await client.rpc('update_my_profile', { _patch: { phone_full: '+393339999999' } });
    assert(!!afterEmailError, `${role}: changing email never unlocks phone`);
    if (role === 'worker') {
      await admin.from('profiles').update({ email, email_otp_verified_at: new Date().toISOString(), email_otp_verified_address: email }).eq('id', id);
    }
  }
} finally {
  // Browser mode keeps only temporary test fixtures until the explicit cleanup run.
  if (process.argv.includes('--browser')) {
    await writeFile('/tmp/browser/phone-lock/users.json', JSON.stringify(created));
  } else {
    for (const id of created) {
      await admin.from('activity_logs').delete().eq('user_id', id);
      await admin.from('notifications').delete().eq('user_id', id);
      await admin.from('user_roles').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error('Test cleanup failed');
    }
  }
}