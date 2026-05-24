
DO $$
DECLARE
  admin_ids uuid[] := ARRAY(SELECT user_id FROM public.user_roles WHERE role='admin');
  target_ids uuid[];
BEGIN
  SELECT ARRAY(SELECT id FROM public.profiles WHERE id <> ALL(admin_ids)) INTO target_ids;

  DELETE FROM public.proposal_responses pr USING public.applications a
   WHERE pr.application_id = a.id
     AND (a.worker_id = ANY(target_ids) OR a.restaurant_id = ANY(target_ids));

  DELETE FROM public.messages m USING public.applications a
   WHERE m.application_id = a.id
     AND (a.worker_id = ANY(target_ids) OR a.restaurant_id = ANY(target_ids));

  DELETE FROM public.activity_logs WHERE user_id = ANY(target_ids);
  DELETE FROM public.credit_transactions WHERE user_id = ANY(target_ids);
  DELETE FROM public.discount_redemptions WHERE user_id = ANY(target_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(target_ids);
  DELETE FROM public.phone_verifications WHERE user_id = ANY(target_ids);
  DELETE FROM public.subscriptions WHERE user_id = ANY(target_ids);
  DELETE FROM public.support_tickets WHERE user_id = ANY(target_ids);
  DELETE FROM public.favorites WHERE user_id = ANY(target_ids);
  DELETE FROM public.worker_availability WHERE worker_id = ANY(target_ids);
  DELETE FROM public.worker_availability_exceptions WHERE worker_id = ANY(target_ids);
  DELETE FROM public.restaurant_worker_favorites WHERE restaurant_id = ANY(target_ids) OR worker_id = ANY(target_ids);
  DELETE FROM public.shifts WHERE worker_id = ANY(target_ids) OR restaurant_id = ANY(target_ids);
  DELETE FROM public.applications WHERE worker_id = ANY(target_ids) OR restaurant_id = ANY(target_ids);
  DELETE FROM public.job_requests WHERE user_id = ANY(target_ids);
  DELETE FROM public.announcements WHERE restaurant_id = ANY(target_ids);
  DELETE FROM public.reviews WHERE author_id = ANY(target_ids) OR target_id = ANY(target_ids);
  DELETE FROM public.required_reviews WHERE worker_user_id = ANY(target_ids) OR restaurant_user_id = ANY(target_ids);
  DELETE FROM public.referral_invites WHERE referrer_user_id = ANY(target_ids) OR referred_user_id = ANY(target_ids);

  BEGIN DELETE FROM public.worker_badges WHERE worker_id = ANY(target_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.worker_incidents WHERE worker_id = ANY(target_ids); EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.user_roles WHERE user_id = ANY(target_ids) AND role <> 'admin';
  DELETE FROM public.profiles WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;
