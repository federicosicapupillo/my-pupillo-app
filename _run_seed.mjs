import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});
const files = fs.readdirSync('/tmp').filter(f => /^seed_\d\.sql$/.test(f)).sort();
for (const f of files) {
  const sql = fs.readFileSync('/tmp/'+f,'utf8');
  console.log(f, sql.length);
  const { error } = await sb.rpc('_tmp_exec_sql', { sql });
  if (error) { console.error(f, error); process.exit(1); }
}
console.log('ALL OK');
