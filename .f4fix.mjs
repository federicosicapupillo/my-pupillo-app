import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const a=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const S=JSON.parse(fs.readFileSync('/tmp/browser/f4/sessions.json','utf8'));
const anag={tax_code:'RSSMRA94A01F205X', birth_date:'1994-01-01', birth_place:'Milano', nationality:'IT', first_name:'F4', last_name:'Test', residence_address:'Via Roma 1', residence_city:'Milano', residence_province:'MI', residence_postal_code:'20100', residence_street:'Via Roma', residence_number:'1', id_document_type:'carta_identita', id_document_number:'AA1234567', id_document_issued_at:'2020-01-01', id_document_expires_at:'2030-01-01', id_document_issuer:'Comune di Milano', id_document_path:'demo/doc.pdf', id_document_back_path:'demo/doc-back.pdf', service_area_radius_m:10000, service_area_city:'Milano', service_area_lat:45.4642, service_area_lng:9.19, work_area_mode:'zones', all_zones:true, avatar_url:'https://example.com/a.png', languages:['it']};
const common={...anag, profile_completed:true, phone_verified:true, age_verified:true, terms_accepted:true, account_status:'active', city:'Milano', province:'MI'};
const jobs=[
 [S.worker.id,{...common, phone_full:'+393330000001', birth_date:'1994-01-01', first_name:'F4', last_name:'Worker', full_name:'F4 Worker', primary_role:'Cameriere', avatar_url:'https://example.com/a.png', hourly_rate:12, tax_code:'RSSMRA94A01F205X', birth_place:'Milano', nationality:'IT', residence_address:'Via Roma 1', residence_city:'Milano', residence_province:'MI', residence_postal_code:'20100', residence_street:'Via Roma', residence_number:'1', id_document_type:'carta_identita', id_document_number:'AA1234567', id_document_issued_at:'2020-01-01', id_document_expires_at:'2030-01-01', id_document_issuer:'Comune di Milano', id_document_path:'demo/doc.pdf', id_document_back_path:'demo/doc-back.pdf', postal_code:'20100', address:'Via Roma 1', street:'Via Roma', street_number:'1', country:'IT', languages:['it'], service_area_city:'Milano', service_area_lat:45.4642, service_area_lng:9.19}],
 [S.restaurant.id,{...common, phone_full:'+393330000002', full_name:'F4 Rest', business_name:'F4 Bistrot', primary_role:'restaurant', vat_number:'12345678903', vat_status:'valid', venue_type:'ristorante', address:'Via Roma 1', postal_code:'20100', country:'IT', representative_age:40, avatar_url:'https://example.com/r.png', contact_person_first_name:'F4', contact_person_last_name:'Rest', contact_person_phone:'+393330000002', latitude:45.4642, longitude:9.19}],
 [S.admin.id,{...common, phone_full:'+393330000003', full_name:'F4 Admin', primary_role:'admin', avatar_url:'https://example.com/ad.png'}],
];
for(const [id,patch] of jobs){
  const {error}=await a.from('profiles').update(patch).eq('id',id);
  console.log(id, error? 'ERR '+error.message : 'ok');
}
const {data}=await a.from('profiles').select('id,email,profile_completed,phone_verified').in('id',jobs.map(j=>j[0]));
console.log(data);
