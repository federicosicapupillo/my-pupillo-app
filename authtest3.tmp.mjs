import { createClient } from "@supabase/supabase-js";
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const email=`audit.email.${Date.now()}@pupillo-audit.test`;
const {data,error}=await admin.auth.admin.createUser({email,password:"TestPasswordSicura123!",email_confirm:true});
const m=(await admin.from("profiles").select("signup_method").eq("id",data?.user?.id).single()).data;
console.log(JSON.stringify({email,id:data?.user?.id,error:error?.message,signup_method:m?.signup_method}));
