import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false}});
const { data, error } = await sb.auth.signInWithPassword({ email: process.argv[2], password: 'Test1234!' });
if (error) { console.error('ERR', error.message); process.exit(1); }
console.log(JSON.stringify(data.session));
