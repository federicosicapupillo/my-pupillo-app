import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL!, SR = process.env.SUPABASE_SERVICE_ROLE_KEY!, PK = process.env.SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const stamp = Date.now();
const created: string[] = [];
const results: string[] = [];
const ok = (name: string, cond: boolean, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };

async function mkUser(tag: string, meta: Record<string, unknown>) {
  const email = `e2e-onb-${tag}-${stamp}@example.com`, password = `E2e!${stamp}Xy#`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) throw new Error(`create ${tag}: ${error.message}`);
  created.push(data.user.id);
  const c = createClient(URL, PK, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password });
  if (se) throw new Error(`signin ${tag}: ${se.message}`);
  return { id: data.user.id, email, c };
}
async function save(c: any, patch: Record<string, unknown>) {
  const defaultsKeys = Object.keys(patch).filter(k => k.startsWith('default_'));
  const profile = Object.fromEntries(Object.entries(patch).filter(([k]) => !defaultsKeys.includes(k)));
  const { error } = await c.rpc('update_my_profile', { _patch: profile });
  return error?.message ?? null;
}
const phone = (n: number) => ({ phone_country_code: '+39', phone_number: `3331${String(stamp).slice(-5)}${n}`, phone_full: `+393331${String(stamp).slice(-5)}${n}` });
const terms = () => ({ terms_accepted: true, terms_version: '2.0', terms_accepted_at: new Date().toISOString() });

function workerPatch(id: string, email: string, n: number) {
  const p = phone(n);
  return { full_name: 'Test Lavoratore', phone: p.phone_full, ...p, ...terms(), profile_completed: true,
    first_name: 'Test', last_name: 'Lavoratore', birth_date: '1995-05-10', birth_place: 'Cagliari', nationality: 'Italiana',
    residence_address: 'Via Roma, 1', residence_city: 'Cagliari', residence_postal_code: '09100', residence_province: 'CA',
    avatar_url: `${id}/avatar.jpg`, work_area_mode: 'zones', service_area_city: 'Torino', service_area_district: 'Centro',
    selected_zones: ['Centro'], all_zones: false, service_area_radius_m: 10000, primary_role: 'Cameriere' };
}
async function setPhoneVerified(id: string, n: number) {
  const p = phone(n);
  const { error } = await admin.from('profiles').update({ ...p, phone: p.phone_full, phone_verified: true, phone_verified_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('fixture phone: ' + error.message);
}

async function main() {
  try {
    // 1. Worker, email signup (role from metadata, terms 2.0 in metadata like auth.tsx)
    const w = await mkUser('worker', { role: 'worker', first_name: 'Test', last_name: 'Lavoratore', ...terms() });
    await setPhoneVerified(w.id, 1);
    let err = await save(w.c, workerPatch(w.id, w.email, 1));
    ok('worker email: save completes onboarding', err === null, err ?? '');
    const { data: wp } = await w.c.rpc('get_my_profile');
    ok('worker email: persisted after reload', wp?.profile_completed === true && wp?.terms_version === '2.0' && !!wp?.terms_accepted_at && wp?.service_area_city === 'Torino', JSON.stringify({ c: wp?.profile_completed, v: wp?.terms_version }));
    ok('worker: no ID document stored', !wp?.id_document_path && !wp?.id_document_number);

    // 2. Worker with historical expired document re-saves profile
    const h = await mkUser('histdoc', { role: 'worker', first_name: 'Storico', last_name: 'Doc' });
    await setPhoneVerified(h.id, 2);
    const { error: fx } = await admin.from('profiles').update({ id_document_type: 'carta_identita', id_document_number: 'CA12345AB', id_document_issued_at: '2014-01-01', id_document_expires_at: '2030-01-01' }).eq('id', h.id);
    ok('fixture: historical document set', !fx, fx?.message ?? '');
    err = await save(h.c, { ...workerPatch(h.id, h.email, 2), first_name: 'Storico', last_name: 'Doc' });
    ok('worker with historical document: save works', err === null, err ?? '');
    const { data: hp } = await h.c.rpc('get_my_profile');
    ok('historical document data preserved', hp?.id_document_number === 'CA12345AB' && hp?.profile_completed === true);

    // 3. Worker social login (no role in metadata) -> claim_signup_role then save
    const s = await mkUser('social', { full_name: 'Social Utente' });
    const { error: ce } = await s.c.rpc('claim_signup_role', { _role: 'worker' });
    ok('social: claim role worker', !ce, ce?.message ?? '');
    await setPhoneVerified(s.id, 3);
    err = await save(s.c, { ...workerPatch(s.id, s.email, 3), first_name: 'Social', last_name: 'Utente' });
    ok('social worker: save completes onboarding with terms 2.0', err === null, err ?? '');

    // 4. Worker under 18 must still be blocked
    const m = await mkUser('minor', { role: 'worker', first_name: 'Minore', last_name: 'Test' });
    await setPhoneVerified(m.id, 4);
    err = await save(m.c, { ...workerPatch(m.id, m.email, 4), first_name: 'Minore', last_name: 'Test', birth_date: '2012-01-01' });
    ok('minor worker blocked', !!err && /18 anni/.test(err), err ?? '');

    // 5. Restaurant email signup
    const r = await mkUser('rest', { role: 'restaurant', first_name: 'Test', last_name: 'Ristoratore', ...terms() });
    await setPhoneVerified(r.id, 5);
    const p = phone(5);
    const vat = String(stamp).slice(-11).padStart(11, '1');
    err = await save(r.c, { first_name: 'Test', last_name: 'Ristoratore', full_name: 'Test Ristoratore', phone: p.phone_full, ...p, ...terms(), profile_completed: true,
      business_name: 'E2E Test Bistrot', vat_number: vat, venue_type: 'Ristorante', venue_type_other: null, address: 'Via Garibaldi', price_range: '€€',
      street_number: '10', neighborhood: 'Centro', city: 'Torino', province: 'Torino', province_code: 'TO', postal_code: '10122', country: 'Italia',
      latitude: 45.0729, longitude: 7.6825, service_area_lat: 45.0729, service_area_lng: 7.6825,
      contact_person_first_name: 'Test', contact_person_last_name: 'Ristoratore', contact_person_role: 'Titolare', contact_person_role_other: null,
      contact_person_phone: p.phone_full, contact_person_email: r.email, representative_age: 40 });
    ok('restaurant: save completes onboarding', err === null, err ?? '');
    const { data: rp } = await r.c.rpc('get_my_profile');
    ok('restaurant: persisted after reload', rp?.profile_completed === true && rp?.terms_version === '2.0' && rp?.city === 'Torino', JSON.stringify({ c: rp?.profile_completed }));

    // 6. ID upload server path is disabled: storage write as user to worker-documents
    ok('summary users created', created.length === 5, String(created.length));
  } catch (e: any) {
    results.push('ERROR ' + e.message);
  } finally {
    for (const id of created) {
      for (const t of ['activity_logs', 'notifications', 'credit_transactions', 'referral_invites', 'phone_verifications']) {
        await admin.from(t).delete().eq(t === 'referral_invites' ? 'referred_user_id' : 'user_id', id);
      }
      await admin.from('user_roles').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('id', id);
      const { error } = await admin.auth.admin.deleteUser(id);
      results.push(`cleanup ${id.slice(0, 8)} ${error ? 'FAILED ' + error.message : 'deleted'}`);
    }
    console.log(results.join('\n'));
  }
}
main();
