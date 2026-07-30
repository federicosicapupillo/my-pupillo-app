import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });
const TS = Date.now();
const BATCH = 'e2e_del_' + TS;
const PW = 'Test1234!';
const out = { batch: BATCH, accounts: {}, ids: {} };

async function mkUser(email, meta) {
  const { data, error } = await sb.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: meta });
  if (error) throw new Error(email + ': ' + error.message);
  return data.user.id;
}
const day = (n) => new Date(Date.now() + n*86400000).toISOString().slice(0,10);

const rid = await mkUser(`e2e.rist.${TS}@pupillo.test`, { full_name: 'E2E Ristoratore', role: 'restaurant' });
const w = [];
for (let i=1;i<=4;i++) w.push(await mkUser(`e2e.worker${i}.${TS}@pupillo.test`, { full_name: `E2E Worker${i}`, role: 'worker' }));
out.accounts = { restaurant: { id: rid, email: `e2e.rist.${TS}@pupillo.test` }, workers: w };

await sb.from('user_roles').upsert([{ user_id: rid, role: 'restaurant' }, ...w.map(id=>({user_id:id, role:'worker'}))], { onConflict: 'user_id,role' });
await sb.from('profiles').update({
  full_name: 'E2E Ristoratore', business_name: 'Trattoria E2E Test', phone: '+393200000999', phone_full: '+393200000999',
  address: 'Via Test 1', city: 'Bologna', province: 'BO', postal_code: '40121',
  contact_person_first_name: 'Mario', contact_person_last_name: 'Test', contact_person_phone: '+393200000998',
  is_demo: true, seed_batch_id: BATCH, profile_completed: true,
}).eq('id', rid);
for (let i=0;i<w.length;i++) {
  await sb.from('profiles').update({ full_name: `E2E Worker${i+1} Rossi`, first_name:`E2E Worker${i+1}`, last_name:'Rossi', city:'Bologna', province:'BO', is_demo: true, seed_batch_id: BATCH, profile_completed: true }).eq('id', w[i]);
}

const baseAnn = (over) => ({
  restaurant_id: rid, service_date: day(10), service_time: '19:00', tariff_type: 'hourly', tariff_amount: 12,
  location_address: 'Via Segreta 42, Bologna', job_address: 'Via Segreta 42', job_city: 'Bologna', job_province: 'BO',
  job_contact_person_name: 'Mario Test', job_contact_person_phone: '+393200000998', job_contact_person_email: 'mario@test.it',
  professional_profile: 'cameriere', status: 'active', end_time: '23:00', is_demo: true, seed_batch_id: BATCH, ...over,
});
const anns = [
  baseAnn({ status: 'draft', notes: 'A0 bozza' }),
  baseAnn({ notes: 'A1 nessuna candidatura' }),
  baseAnn({ notes: 'A2 due candidature pendenti' }),
  baseAnn({ notes: 'A3 proposta inviata' }),
  baseAnn({ notes: 'A4 turno futuro assegnato', service_date: day(7), status: 'assigned' }),
  baseAnn({ notes: 'A5 turno imminente', service_date: day(0), status: 'assigned' }),
  baseAnn({ notes: 'A6 turno concluso', service_date: day(-10), status: 'completed' }),
];
const { data: annRows, error: annErr } = await sb.from('announcements').insert(anns).select('id, notes, status');
if (annErr) throw annErr;
const A = Object.fromEntries(annRows.map(r=>[r.notes.slice(0,2), r.id]));
out.ids.announcements = A;

const app = (annKey, workerIdx, status) => ({ announcement_id: A[annKey], worker_id: w[workerIdx], restaurant_id: rid, status, is_demo: true, seed_batch_id: BATCH });
const { data: appRows, error: appErr } = await sb.from('applications').insert([
  app('A2', 0, 'pending'), app('A2', 1, 'pending'),
  app('A3', 2, 'pending'),
  app('A4', 0, 'accepted'),
  app('A5', 3, 'accepted'),
  app('A6', 1, 'accepted'),
]).select('id, announcement_id, worker_id, status');
if (appErr) throw appErr;
out.ids.applications = appRows;
const findApp = (annKey, wi) => appRows.find(r=>r.announcement_id===A[annKey] && r.worker_id===w[wi]).id;

// proposal message on A3 (worker3)
const { error: msgErr } = await sb.from('messages').insert([{
  application_id: findApp('A3', 2), sender_id: rid, receiver_id: w[2], body: 'Nuova proposta di lavoro',
  message_type: 'template', template_id: 'shift_proposal', action_type: 'propose_shift', is_demo: true, seed_batch_id: BATCH,
}]);
if (msgErr) throw msgErr;

const { data: shiftRows, error: shErr } = await sb.from('shifts').insert([
  { announcement_id: A['A4'], restaurant_id: rid, worker_id: w[0], shift_date: day(7), status: 'scheduled', hours: 4, amount: 48, is_demo: true, seed_batch_id: BATCH },
  { announcement_id: A['A5'], restaurant_id: rid, worker_id: w[3], shift_date: day(0), status: 'scheduled', hours: 4, amount: 48, is_demo: true, seed_batch_id: BATCH },
  { announcement_id: A['A6'], restaurant_id: rid, worker_id: w[1], shift_date: day(-10), status: 'completed', hours: 5, amount: 60, completed_at: new Date(Date.now()-10*86400000).toISOString(), is_demo: true, seed_batch_id: BATCH },
]).select('id, announcement_id, worker_id, status, shift_date');
if (shErr) throw shErr;
out.ids.shifts = shiftRows;
const completedShift = shiftRows.find(s=>s.status==='completed');

const { data: revRows, error: revErr } = await sb.from('reviews').insert([
  { author_id: rid, target_id: w[1], shift_id: completedShift.id, announcement_id: A['A6'], application_id: findApp('A6',1), rating: 5, comment: 'Ottimo lavoro E2E', direction: 'restaurant_to_worker', visible_at: new Date(Date.now()-9*86400000).toISOString(), is_demo: true, seed_batch_id: BATCH },
  { author_id: w[1], target_id: rid, shift_id: completedShift.id, announcement_id: A['A6'], application_id: findApp('A6',1), rating: 4, comment: 'Locale ok E2E', direction: 'worker_to_restaurant', visible_at: new Date(Date.now()-9*86400000).toISOString(), is_demo: true, seed_batch_id: BATCH },
]).select('id, direction, rating');
if (revErr) throw revErr;
out.ids.reviews = revRows;

// pre-existing notifications pointing at announcements
const { error: notErr } = await sb.from('notifications').insert([
  { user_id: w[0], title: 'Nuovo annuncio', body: 'Annuncio disponibile', link: '/announcements/' + A['A2'], dedupe_key: 'e2e_pre:'+BATCH+':1', is_demo: true, seed_batch_id: BATCH },
  { user_id: w[2], title: 'Nuovo annuncio', body: 'Annuncio disponibile', link: '/announcements/' + A['A3'], dedupe_key: 'e2e_pre:'+BATCH+':2', is_demo: true, seed_batch_id: BATCH },
]);
if (notErr) throw notErr;

console.log(JSON.stringify(out, null, 2));
