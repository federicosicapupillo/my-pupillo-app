
UPDATE public.profiles
   SET experience_level = 'intermediate'
 WHERE is_demo = true
   AND primary_role = 'worker'
   AND (experience_level IS NULL);
