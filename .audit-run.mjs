import { createClient } from '@supabase/supabase-js';
const URL=process.env.SUPABASE_URL, PUB=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY, SR=process.env.SUPABASE_SERVICE_ROLE_KEY;
const adm = createClient(URL, SR, { auth:{persistSession:false} });
const C = { BATCH:'audit_1785857137788', rid:'57f1d1cc-d829-4887-85d1-e86b02f74e73', wid:'3d547c34-51b6-4ae7-81ed-6d1e84ed5972',
  rEmail:'audit.rist.1785857137788@pupillo.test', wEmail:'audit.worker.1785857137788@pupillo.test', PW:'Test1234!',
  A:{A1:'cf1d088a-81f4-493b-98c7-f0360fb05896',A2:'08604541-539f-4cd2-ab08-14b064faa8a7',A3:'de4619d6-687d-447f-b893-a99d6409e07a',A4:'5f7b0407-9f80-4505-a535-0e5e85c6f774'},
  APP:{A1:'95691196-8f7d-4f71-b864-0cc02a6bf771',A2:'72c45a91-0b2e-48dc-bb0e-d659e4625397',A3:'5a7680b0-4df8-4809-9fb9-67243c3b56d7',A4:'53f2fa8c-73ec-409b-a9f1-91c344664741'} };
const fresh = () => createClient(URL, PUB, { auth:{persistSession:false, autoRefreshToken:false}, realtime:{params:{eventsPerSecond:1}} });
async function signIn(email){ const c=fresh(); const {error}=await c.auth.signInWithPassword({email,password:C.PW}); if(error) throw new Error(email+': '+error.message); return c; }
const R=[]; const rec=(n,pass,d)=>{R.push({n,pass,d}); console.log((pass?'PASS':'FAIL')+' | '+n+' | '+JSON.stringify(d));};

// ---------- 6. RACE ----------
const r1 = await signIn(C.rEmail), r2 = await signIn(C.rEmail);
const t0=Date.now();
const [x1,x2] = await Promise.all([
  r1.rpc('accept_application_atomic',{ _application_id: C.APP.A1 }),
  r2.rpc('accept_application_atomic',{ _application_id: C.APP.A2 }),
]);
const res=[x1.data??x1.error?.message, x2.data??x2.error?.message];
const codes = res.map(r=>r?.code ?? String(r));
rec('6.race: esattamente 1 ok + 1 worker_shift_conflict', codes.filter(c=>c==='assigned').length===1 && codes.includes('worker_shift_conflict'), {codes, ms:Date.now()-t0});

const { data: shifts } = await adm.from('shifts').select('id,announcement_id,status,worker_id').eq('worker_id',C.wid);
rec('6.race: un solo shift creato', shifts.length===1, shifts);
const { data: tx } = await adm.from('credit_transactions').select('id,delta,balance_after,kind,reason,reference_id').eq('user_id',C.rid).eq('reason','assign_worker');
rec('6.race: un solo addebito', tx.length===1, tx);
const { data: accepted } = await adm.from('applications').select('id,status,announcement_id').eq('worker_id',C.wid);
rec('6.race: una sola candidatura accepted', accepted.filter(a=>a.status==='accepted').length===1, accepted.map(a=>[Object.keys(C.APP).find(k=>C.APP[k]===a.id),a.status]));

// ---------- 2/3. NOTIFICA ----------
const { data: notifs } = await adm.from('notifications').select('id,user_id,title,link,metadata,dedupe_key,read,created_at').in('user_id',[C.wid,C.rid]).order('created_at');
const conf = notifs.filter(n=>n.metadata?.notification_type==='shift_assignment_confirmed');
const winApp = accepted.find(a=>a.status==='accepted').id;
const shift = shifts[0];
rec('3.idempotenza: 1 sola notifica di conferma', conf.length===1, conf.map(n=>({dedupe:n.dedupe_key, cid:n.metadata.conversation_id, sid:n.metadata.shift_id})));
rec('2.notifica: conversation_id/shift_id corrispondono a record reali', conf[0]?.metadata?.conversation_id===winApp && conf[0]?.metadata?.shift_id===shift.id, {conversation_id:conf[0]?.metadata?.conversation_id, app:winApp, shift_id:conf[0]?.metadata?.shift_id, shift:shift.id});
rec('2.notifica: nessuna notifica con conversation_id nullo', !notifs.some(n=>n.metadata && 'conversation_id' in n.metadata && !n.metadata.conversation_id), {tot:notifs.length});

// retry idempotenza
const again = await r1.rpc('accept_application_atomic',{ _application_id: winApp });
const { data: notifs2 } = await adm.from('notifications').select('id').eq('user_id',C.wid).eq('dedupe_key', conf[0]?.dedupe_key ?? 'x');
rec('3.retry: seconda esecuzione idempotente, notifica non duplicata', again.data?.code==='already_assigned' && notifs2.length===1, {retry:again.data, notif_rows:notifs2.length});

// ---------- 4. CHIUSURA SOVRAPPOSTE ----------
const st = Object.fromEntries(accepted.map(a=>[Object.keys(C.APP).find(k=>C.APP[k]===a.id), a.status]));
rec('4.sovrapposte: A3 (overlap, pending) chiusa=expired', st.A3==='expired', st);
rec('4.non sovrapposte: A4 resta pending', st.A4==='pending', st);
const loser = codes[0]==='assigned' ? 'A2' : 'A1';
rec('4.perdente race chiusa per conflitto', st[loser]==='expired', {loser, status:st[loser]});
const { data: logs } = await adm.from('activity_logs').select('entity_id,action,metadata').eq('action','application_closed');
rec('4.motivazione tecnica registrata (confirmed_shift_conflict)', logs.length>0 && logs.every(l=>l.metadata?.reason==='confirmed_shift_conflict'), logs.map(l=>l.metadata?.reason));
const closedNotifs = notifs.filter(n=>n.metadata?.kind==='application_closed_shift_conflict');
const dup = new Set(closedNotifs.map(n=>n.dedupe_key)).size===closedNotifs.length;
rec('4.nessuna notifica duplicata per chiusura conflitto', dup, closedNotifs.map(n=>n.dedupe_key));
rec('4.accepted non modificata impropriamente', accepted.filter(a=>a.status==='accepted').length===1, {accepted:winApp});

// ---------- 1. APERTURA CHAT DA NOTIFICA ----------
async function coldOpen(label, client) {
  const { data: n, error: ne } = await client.from('notifications').select('id,link,metadata,read').eq('user_id',C.wid).eq('metadata->>notification_type','shift_assignment_confirmed').maybeSingle();
  if (ne) return { ok:false, err:'notif:'+ne.message };
  const cid = n?.metadata?.conversation_id;
  const [a, s, ann, msg] = await Promise.all([
    client.from('applications').select('id,status,worker_id,restaurant_id,announcement_id').eq('id',cid).maybeSingle(),
    client.from('shifts').select('id,status,shift_date,announcement_id').eq('id', n?.metadata?.shift_id).maybeSingle(),
    client.from('announcements').select('id,service_date,service_time,status,tariff_amount').eq('id', n?.metadata?.announcement_id).maybeSingle(),
    client.from('messages').select('id,message_type').eq('application_id', cid),
  ]);
  const errs=[a.error,s.error,ann.error,msg.error].filter(Boolean).map(e=>e.message);
  return { ok: !!n && n.link==='/messages/'+cid && !!a.data && a.data.status==='accepted' && !!s.data && !!ann.data && errs.length===0,
    link:n?.link, appStatus:a.data?.status, shift:s.data?.status, annStatus:ann.data?.status, msgs:msg.data?.length, errs };
}
// a) click immediato dopo la conferma (stessa sessione worker gia' attiva)
const wLive = await signIn(C.wEmail);
rec('1a.click immediato dopo conferma', (await coldOpen('a',wLive)).ok, await coldOpen('a',wLive));
// b) nuova scheda = nuovo client, nuova sessione
rec('1b.nuova scheda (client separato)', (await coldOpen('b', await signIn(C.wEmail))).ok, await coldOpen('b', await signIn(C.wEmail)));
// c) cold start: client nuovo, nessun realtime, nessuna cache
const cold = await signIn(C.wEmail); const rc = await coldOpen('c', cold);
rec('1c.cold start senza realtime/cache', rc.ok, rc);
// f) rete lenta simulata (ritardo tra sign-in e query)
const slow = await signIn(C.wEmail); await new Promise(r=>setTimeout(r,1500)); rec('1f.rete lenta', (await coldOpen('f',slow)).ok, await coldOpen('f',slow));
// g) logout/login
await slow.auth.signOut(); const relog = await signIn(C.wEmail); rec('1g.ritorno dopo logout/login', (await coldOpen('g',relog)).ok, await coldOpen('g',relog));
// h) navigazione rapida tra due notifiche diverse
const { data: two } = await relog.from('notifications').select('id,link,metadata').eq('user_id',C.wid).order('created_at',{ascending:false}).limit(2);
const rapid = await Promise.all(two.map(n=>relog.from('applications').select('id,status').eq('id', n.metadata?.application_id ?? n.metadata?.conversation_id).maybeSingle()));
rec('1h.navigazione rapida tra 2 notifiche diverse', two.length===2 && rapid.every(r=>!r.error && r.data) && new Set(two.map(n=>n.link)).size===2, { links: two.map(n=>n.link), statuses: rapid.map(r=>r.data?.status), errs: rapid.map(r=>r.error?.message).filter(Boolean) });
// marca letta senza interrompere navigazione
const nid = (await relog.from('notifications').select('id').eq('user_id',C.wid).eq('metadata->>notification_type','shift_assignment_confirmed').maybeSingle()).data.id;
const upd = await relog.from('notifications').update({ read:true }).eq('id', nid).select('id,read,read_at').maybeSingle();
const afterRead = await coldOpen('read', relog);
rec('1.notifica marcata letta senza interrompere apertura', !upd.error && upd.data?.read===true && afterRead.ok, { read:upd.data?.read, err:upd.error?.message, stillOpens:afterRead.ok });
// nessuna conversazione duplicata
const { data: allApps } = await adm.from('applications').select('id,announcement_id').eq('worker_id',C.wid);
rec('1.nessuna conversazione duplicata', new Set(allApps.map(a=>a.announcement_id)).size===allApps.length, {n:allApps.length});

console.log('\nSUMMARY', JSON.stringify({ pass:R.filter(r=>r.pass).length, fail:R.filter(r=>!r.pass).length, failed:R.filter(r=>!r.pass).map(r=>r.n) }));
