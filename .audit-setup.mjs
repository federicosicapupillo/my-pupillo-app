import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, SR, { auth: { persistSession: false } });
const TS = Date.now(); const BATCH = 'audit_' + TS; const PW = 'Test1234!';
const mk = async (email, meta) => { const { data, error } = await sb.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: meta }); if (error) throw new Error(email+': '+error.message); return data.user.id; };
const day = n => new Date(Date.now()+n*86400000).toISOString().slice(0,10);

const rEmail = `audit.rist.${TS}@pupillo.test`, wEmail = `audit.worker.${TS}@pupillo.test`;
const rid = await mk(rEmail, { full_name:'Audit Rist', role:'restaurant' });
const wid = await mk(wEmail, { full_name:'Audit Worker', role:'worker' });
await sb.from('user_roles').upsert([{user_id:rid,role:'restaurant'},{user_id:wid,role:'worker'}],{onConflict:'user_id,role'});
let e;
({ error: e } = await sb.from('profiles').update({ full_name:'Audit Rist', business_name:'Trattoria Audit', vat_number:'12345678901', phone:'+393200001999', phone_full:'+393200001999', phone_verified:true, address:'Via Test 1', city:'Bologna', province:'BO', postal_code:'40121', contact_person_first_name:'Mario', contact_person_last_name:'Audit', contact_person_phone:'+393200001998', profile_completed:true, is_demo:true, seed_batch_id:BATCH }).eq('id', rid));
if (e) console.log('rist profile err', e.message);
({ error: e } = await sb.from('profiles').update({ full_name:'Audit Worker Rossi', first_name:'Audit', last_name:'Rossi', avatar_url:'avatars/audit.jpg', city:'Bologna', province:'BO', phone_verified:true, profile_completed:true, is_demo:true, seed_batch_id:BATCH }).eq('id', wid));
if (e) console.log('worker profile err', e.message);
const { data: cr, error: ce } = await sb.rpc('grant_credits', { _user_id: rid, _amount: 100, _kind: 'grant', _reason: 'audit', _reference_id: BATCH });
console.log('credits', cr, ce?.message);

const base = o => ({ restaurant_id: rid, service_date: day(6), service_time:'19:00:00', end_time:'23:00:00', duration_hours:4, speed:'normal', tariff_type:'hourly', tariff_amount:12, location_address:'Via Segreta 42, Bologna', job_address:'Via Segreta 42', job_city:'Bologna', job_province:'BO', job_postal_code:'40121', job_contact_person_name:'Mario Audit', job_contact_person_phone:'+393200001998', job_contact_person_email:'m@audit.it', professional_profile:'cameriere', status:'active', expires_at: new Date(Date.now()+5*86400000).toISOString(), is_demo:true, seed_batch_id:BATCH, ...o });
const { data: anns, error: ae } = await sb.from('announcements').insert([
  base({ notes:'A1 overlap' }),
  base({ notes:'A2 overlap' }),
  base({ notes:'A3 overlap' }),
  base({ notes:'A4 no-overlap', service_date: day(8), service_time:'10:00:00', end_time:'14:00:00' }),
]).select('id, notes, shift_start_at');
if (ae) throw ae;
const A = Object.fromEntries(anns.map(r=>[r.notes.slice(0,2), r.id]));
const { data: apps, error: pe } = await sb.from('applications').insert(
  Object.entries(A).map(([k,id])=>({ announcement_id:id, worker_id:wid, restaurant_id:rid, status:'pending', response_deadline: new Date(Date.now()+4*86400000).toISOString(), is_demo:true, seed_batch_id:BATCH }))
).select('id, announcement_id');
if (pe) throw pe;
const APP = Object.fromEntries(Object.entries(A).map(([k,id])=>[k, apps.find(a=>a.announcement_id===id).id]));
console.log(JSON.stringify({ BATCH, rid, wid, rEmail, wEmail, A, APP, starts: anns.map(a=>[a.notes.slice(0,2), a.shift_start_at]) }, null, 1));
