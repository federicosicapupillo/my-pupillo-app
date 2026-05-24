import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const PASSWORD = 'Test1234!';
const BATCH = 'seed_d_' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);

const FN_M = ["Marco","Luca","Giuseppe","Andrea","Francesco","Matteo","Davide","Stefano","Alessandro","Paolo","Roberto","Giovanni","Antonio","Simone","Riccardo","Federico","Tommaso","Lorenzo","Pietro","Nicola"];
const FN_F = ["Giulia","Sara","Chiara","Francesca","Martina","Alessia","Elena","Valentina","Laura","Silvia","Anna","Federica","Eleonora","Camilla","Beatrice","Greta","Marta","Roberta","Ilaria","Veronica"];
const LN = ["Rossi","Bianchi","Romano","Russo","Ferrari","Esposito","Bruno","Greco","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti","Barbieri","Fontana","Santoro","Mariani","Rinaldi","Caruso","Ferrara","Galli","Martini","Leone","Longo","Gentile","Marini","Vitale"];
const ROLES = ["cameriere","barista","chef","aiuto_cucina","lavapiatti","pizzaiolo","runner","sommelier","hostess","addetto_sala"];
const VENUES = ["ristorante","pizzeria","trattoria","osteria","bar","bistrot","enoteca","hotel_ristorante"];
const CITIES = [
  { city:"Torino", province:"Torino", pc:"TO", zip:"10121", lat:45.0703, lng:7.6869 },
  { city:"Milano", province:"Milano", pc:"MI", zip:"20121", lat:45.4642, lng:9.19 },
  { city:"Bologna", province:"Bologna", pc:"BO", zip:"40121", lat:44.4949, lng:11.3426 },
  { city:"Roma", province:"Roma", pc:"RM", zip:"00184", lat:41.9028, lng:12.4964 },
  { city:"Firenze", province:"Firenze", pc:"FI", zip:"50122", lat:43.7696, lng:11.2558 },
  { city:"Como", province:"Como", pc:"CO", zip:"22100", lat:45.8081, lng:9.0852 },
];
const pick = a => a[(Math.random()*a.length)|0];
const ri = (a,b) => ((Math.random()*(b-a+1))|0)+a;
const jit = (b,s=0.04) => b + (Math.random()-0.5)*s;
const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ", N="0123456789";
const rep=(s,n)=>Array.from({length:n},()=>s[(Math.random()*s.length)|0]).join("");
const taxCode=()=>rep(L,6)+rep(N,2)+rep(L,1)+rep(N,2)+rep(L,1)+rep(N,3)+rep(L,1);
const idNum=()=>rep(L,2)+rep(N,5)+rep(L,2);
const vat=()=>rep(N,11);
const pad=(n,w)=>String(n).padStart(w,'0');

let phoneCounter = 3200000000;
const newPhone = () => { phoneCounter++; const s='+39'+phoneCounter; return s; };

const report = { workersCreated:0, restaurantsCreated:0, skipped:0, errors:[], announcements:0, applications:0, shifts:0, reviews:0, notifications:0 };

// Pre-load existing demo test emails
console.log('Loading existing auth users...');
const existingEmails = new Set();
let page = 1;
while (true) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error); break; }
  data.users.forEach(u => { if (u.email) existingEmails.add(u.email.toLowerCase()); });
  if (!data.users.length || data.users.length < 1000) break;
  page++;
}
console.log('Existing users:', existingEmails.size);

async function createUser(email, role, fullName) {
  if (existingEmails.has(email.toLowerCase())) {
    report.skipped++;
    const { data } = await sb.auth.admin.listUsers({ page:1, perPage:1 });
    // Find existing id via query
    const { data: prof } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    return prof?.id ?? null;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error || !data.user) { report.errors.push(`auth ${email}: ${error?.message}`); return null; }
  existingEmails.add(email.toLowerCase());
  return data.user.id;
}

async function seedRestaurant(i) {
  const fn = pick([...FN_M,...FN_F]); const ln = pick(LN); const c = pick(CITIES);
  const email = `ristoratore.d${pad(i,3)}@pupillo.test`;
  const businessName = `Ristorante ${pick(LN)} (test)`;
  const fullName = `${fn} ${ln}`;
  const uid = await createUser(email, 'restaurant', fullName);
  if (!uid) return null;

  await sb.from('user_roles').delete().eq('user_id', uid);
  await sb.from('user_roles').insert({ user_id: uid, role: 'restaurant' });

  const phone = newPhone();
  const update = {
    is_demo: true, seed_batch_id: BATCH,
    full_name: fullName, business_name: businessName,
    vat_number: vat(), vat_status: 'valid', vat_company_name: businessName, vat_verified_at: new Date().toISOString(),
    company_tax_code: taxCode(),
    venue_type: pick(VENUES),
    city: c.city, province: c.province, province_code: c.pc, postal_code: c.zip, country: 'Italia',
    latitude: jit(c.lat), longitude: jit(c.lng),
    service_area_lat: jit(c.lat,0.02), service_area_lng: jit(c.lng,0.02), service_area_radius_m: 5000,
    address: `Via ${pick(LN)} ${ri(1,80)}, ${c.city}`,
    neighborhood: pick(['Centro','Navigli','Brera','Isola','Porta Romana','Duomo']),
    contact_person_first_name: fn, contact_person_last_name: ln,
    contact_person_email: email, contact_person_phone: phone, contact_person_role: 'owner',
    price_range: pick(['€','€€','€€€']), opening_hours: 'Lun-Sab 12:00-15:00, 19:00-23:30',
    employees_count: ri(2,25),
    avatar_url: `https://i.pravatar.cc/400?img=${(i%70)+1}`,
    phone, phone_full: phone, phone_verified: true, phone_verified_at: new Date().toISOString(),
    whatsapp_connected: true, terms_accepted: true, profile_completed: true,
    account_status: 'active', plan: 'free', credits: 10,
  };
  const { error } = await sb.from('profiles').update(update).eq('id', uid);
  if (error) { report.errors.push(`prof rest ${email}: ${error.message}`); return null; }
  report.restaurantsCreated++;
  return uid;
}

async function seedWorker(i) {
  const isF = Math.random()<0.5;
  const fn = pick(isF?FN_F:FN_M); const ln = pick(LN); const c = pick(CITIES);
  const email = `lavoratore.d${pad(i,3)}@pupillo.test`;
  const fullName = `${fn} ${ln}`;
  const uid = await createUser(email, 'worker', fullName);
  if (!uid) return null;

  // worker role is the default from handle_new_user — ensure it exists
  await sb.from('user_roles').upsert({ user_id: uid, role: 'worker' }, { onConflict: 'user_id,role' });

  const today = new Date();
  const birth = new Date(today.getFullYear()-ri(22,45), ri(0,11), ri(1,28));
  const issued = new Date(today.getFullYear()-ri(1,5), ri(0,11), ri(1,28));
  const expires = new Date(today.getFullYear()+ri(2,8), ri(0,11), ri(1,28));
  const phone = newPhone();
  const role = pick(ROLES);
  const avail = [];
  if (Math.random()<0.4) avail.push('sab_sera','dom_sera','sab_pranzo','dom_pranzo');
  if (Math.random()<0.25) avail.push('lun_sera','mar_sera','mer_sera','gio_sera','ven_sera');
  avail.push('ven_sera','sab_sera');

  const update = {
    is_demo: true, seed_batch_id: BATCH,
    full_name: fullName, first_name: fn, last_name: ln,
    birth_date: birth.toISOString().slice(0,10), birth_place: c.city, nationality: 'Italia',
    tax_code: taxCode(),
    residence_address: `Via ${pick(LN)} ${ri(1,80)}`, residence_city: c.city,
    residence_postal_code: c.zip, residence_province: c.pc,
    id_document_type: 'carta_identita', id_document_number: idNum(),
    id_document_issued_at: issued.toISOString().slice(0,10),
    id_document_expires_at: expires.toISOString().slice(0,10),
    id_document_issuer: 'Comune di '+c.city,
    id_document_path: `demo/${uid}/fac_simile_test_fronte.pdf`,
    id_document_back_path: `demo/${uid}/fac_simile_test_retro.pdf`,
    avatar_url: `https://i.pravatar.cc/400?img=${(i%70)+1}`,
    primary_role: role, secondary_roles: [pick(ROLES)],
    experience_years: ri(0,12), experience_level: pick(['junior','intermediate','senior']),
    hourly_rate: ri(9,18), is_motorized: Math.random()<0.5,
    short_bio: 'Profilo di test per la piattaforma Pupillo.',
    languages: ['it'],
    weekly_availability: Array.from(new Set(avail)),
    city: c.city, province: c.province, province_code: c.pc, neighborhood: 'Centro',
    service_area_city: c.city, service_area_district: 'Centro',
    service_area_lat: jit(c.lat,0.02), service_area_lng: jit(c.lng,0.02), service_area_radius_m: 10000,
    work_area_mode: 'zones', all_zones: false, selected_zones: ['Centro'],
    badge: pick(['basic','pro','elite']),
    phone, phone_full: phone, phone_verified: true, phone_verified_at: new Date().toISOString(),
    whatsapp_connected: true, age_verified: true, age_verified_at: new Date().toISOString(),
    terms_accepted: true, profile_completed: true, account_status: 'active',
  };
  const { error } = await sb.from('profiles').update(update).eq('id', uid);
  if (error) { report.errors.push(`prof worker ${email}: ${error.message}`); return null; }
  report.workersCreated++;
  return uid;
}

console.log('Seeding restaurants...');
const restaurantIds = [];
for (let i=1; i<=100; i++) {
  const id = await seedRestaurant(i);
  if (id) restaurantIds.push(id);
  if (i%10===0) console.log(' rest', i);
}

console.log('Seeding workers...');
const workerIds = [];
for (let i=1; i<=300; i++) {
  const id = await seedWorker(i);
  if (id) workerIds.push(id);
  if (i%25===0) console.log(' work', i);
}

console.log('Seeding announcements/applications/shifts/reviews...');
const today = new Date();
let annCount=0;
// 50 active future + 30 past (for shifts)
for (let k=0; k<80 && restaurantIds.length; k++) {
  const rid = pick(restaurantIds);
  const isPast = k>=50;
  const offset = isPast ? -ri(5,30) : ri(2,30);
  const d = new Date(today); d.setDate(d.getDate()+offset);
  const tariff = ri(10,18); const hours = ri(3,6);
  const c = pick(CITIES);
  const { data, error } = await sb.from('announcements').insert({
    restaurant_id: rid, service_date: d.toISOString().slice(0,10),
    service_time: '19:00', duration_hours: hours,
    tariff_type:'hourly', tariff_amount: tariff,
    location_address: `Via ${pick(LN)} ${ri(1,50)}, ${c.city}`,
    location_lat: jit(c.lat), location_lng: jit(c.lng),
    professional_profile: pick(ROLES),
    status: isPast ? 'completed' : 'active',
    is_demo: true, seed_batch_id: BATCH,
  }).select('id').single();
  if (error) { report.errors.push(`ann: ${error.message}`); continue; }
  annCount++;
  const annId = data.id;

  // applications
  const nApps = ri(2,4);
  let accepted = null;
  for (let j=0; j<nApps && workerIds.length; j++) {
    const wid = pick(workerIds);
    const willAccept = isPast && j===0;
    const status = willAccept ? 'accepted' : (isPast ? 'rejected' : pick(['pending','interested','pending']));
    const { error: ae } = await sb.from('applications').insert({
      announcement_id: annId, worker_id: wid, restaurant_id: rid,
      status, is_demo: true, seed_batch_id: BATCH,
    });
    if (!ae) report.applications++;
    if (willAccept) accepted = wid;
  }
  if (isPast && accepted) {
    const { data: sh, error: se } = await sb.from('shifts').insert({
      announcement_id: annId, restaurant_id: rid, worker_id: accepted,
      shift_date: d.toISOString().slice(0,10), hours, amount: tariff*hours,
      status: 'completed', completed_at: d.toISOString(),
      is_demo: true, seed_batch_id: BATCH,
    }).select('id').single();
    if (!se && sh) {
      report.shifts++;
      if (Math.random()<0.7) {
        const p=ri(3,5),pr=ri(3,5),co=ri(3,5),re=ri(3,5),te=ri(3,5);
        const { error: re2 } = await sb.from('reviews').insert({
          target_id: accepted, author_id: rid, shift_id: sh.id, announcement_id: annId,
          rating: Math.round((p+pr+co+re+te)/5),
          punctuality: p, professionalism: pr, competence: co, reliability: re, teamwork: te,
          comment: pick(['Ottimo lavoro.','Puntuale e professionale.','Esperienza positiva.','Bravo, lo richiameremo.']),
          would_rehire: pick(['yes','yes','maybe']),
          is_demo: true, seed_batch_id: BATCH,
        });
        if (!re2) report.reviews++;
      }
    }
  }
}
report.announcements = annCount;

// recompute reputation
for (const wid of workerIds) {
  await sb.rpc('recompute_worker_reputation', { _worker: wid }).catch(()=>{});
}

// retag notifications
await sb.from('notifications').update({ is_demo: true, seed_batch_id: BATCH }).in('user_id', [...workerIds, ...restaurantIds]).eq('is_demo', false);

await sb.from('activity_logs').insert({
  action: 'admin.seed_test_users_d',
  entity_type: 'profiles',
  metadata: { batch: BATCH, ...report, password: PASSWORD },
});

console.log('\n=== REPORT ===');
console.log(JSON.stringify(report, null, 2));
console.log('Batch:', BATCH);
console.log('Errors sample:', report.errors.slice(0,5));
