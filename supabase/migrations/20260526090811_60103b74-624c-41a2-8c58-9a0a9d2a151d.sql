revoke execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) from public;
revoke execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) from anon;
grant execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) to authenticated;

revoke execute on function public.can_read_application(uuid, uuid, uuid) from public;
revoke execute on function public.can_read_application(uuid, uuid, uuid) from anon;
grant execute on function public.can_read_application(uuid, uuid, uuid) to authenticated;

revoke execute on function public.can_update_application(uuid, uuid, uuid) from public;
revoke execute on function public.can_update_application(uuid, uuid, uuid) from anon;
grant execute on function public.can_update_application(uuid, uuid, uuid) to authenticated;
