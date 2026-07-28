-- Principle of least privilege for public.profiles, public.reviews, public.announcements.
-- Rationale, per audit of the client codebase:
--   profiles: no client .insert(); no client .delete() (handled by handle_new_user
--             trigger and delete_my_account RPC respectively). Only SELECT+UPDATE needed.
--   reviews:  no client .delete(). Only SELECT+INSERT+UPDATE needed.
--   announcements: SELECT/INSERT/UPDATE/DELETE all used by restaurant flows; anon
--                  only reads active announcements via the public browse policy.
-- RLS policies are untouched; row-level access control is unchanged.

-- profiles: strip everything except SELECT + UPDATE from authenticated
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.profiles FROM authenticated;
-- profiles: anon has no legitimate access path (Data API is authenticated-only,
-- signup writes are performed by the SECURITY DEFINER trigger handle_new_user).
REVOKE ALL ON public.profiles FROM anon;

-- reviews: strip DELETE and the non-DML privileges from authenticated
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.reviews FROM authenticated;
REVOKE ALL ON public.reviews FROM anon;

-- announcements: strip non-DML privileges from authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.announcements FROM authenticated;
-- announcements: anon only needs SELECT (RLS shows only status='active')
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.announcements FROM anon;
