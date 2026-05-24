import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const report = { authDeleted: 0, storageDeleted: 0, tables: {}, errors: [] };

// 1. Empty storage buckets
const { data: buckets } = await sb.storage.listBuckets();
for (const b of buckets ?? []) {
  async function purge(prefix='') {
    const { data: items, error } = await sb.storage.from(b.name).list(prefix, { limit: 1000 });
    if (error) { report.errors.push(`list ${b.name}/${prefix}: ${error.message}`); return; }
    if (!items?.length) return;
    const files = items.filter(i => i.id);
    const folders = items.filter(i => !i.id);
    if (files.length) {
      const paths = files.map(f => prefix ? `${prefix}/${f.name}` : f.name);
      const { error: dErr } = await sb.storage.from(b.name).remove(paths);
      if (dErr) report.errors.push(`remove ${b.name}: ${dErr.message}`);
      else report.storageDeleted += paths.length;
    }
    for (const f of folders) {
      await purge(prefix ? `${prefix}/${f.name}` : f.name);
    }
  }
  await purge();
}
console.log('Storage purged:', report.storageDeleted);

// 2. List all auth users and delete
let page = 1;
const allUsers = [];
while (true) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { report.errors.push(`listUsers: ${error.message}`); break; }
  allUsers.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}
console.log('Auth users found:', allUsers.length);

for (const u of allUsers) {
  const { error } = await sb.auth.admin.deleteUser(u.id);
  if (error) report.errors.push(`delete ${u.email}: ${error.message}`);
  else report.authDeleted++;
}
console.log('Auth deleted:', report.authDeleted);

console.log(JSON.stringify(report, null, 2));
