CREATE OR REPLACE FUNCTION public.canonical_job_role(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE regexp_replace(lower(unaccent_fallback), '[^a-z0-9]', '', 'g')
    WHEN 'cameriere' THEN 'Cameriere'
    WHEN 'camerieri' THEN 'Cameriere'
    WHEN 'cameriera' THEN 'Cameriere'
    WHEN 'chefderang' THEN 'Cameriere'
    WHEN 'commisdisala' THEN 'Cameriere'
    WHEN 'bartender' THEN 'Bartender'
    WHEN 'barman' THEN 'Bartender'
    WHEN 'barlady' THEN 'Bartender'
    WHEN 'barista' THEN 'Barista'
    WHEN 'chef' THEN 'Chef'
    WHEN 'cuoco' THEN 'Chef'
    WHEN 'cuoca' THEN 'Chef'
    WHEN 'aiutocucina' THEN 'Aiuto cucina'
    WHEN 'aiutocuoco' THEN 'Aiuto cucina'
    WHEN 'commisdicucina' THEN 'Aiuto cucina'
    WHEN 'lavapiatti' THEN 'Lavapiatti'
    WHEN 'runner' THEN 'Runner'
    WHEN 'hostess' THEN 'Hostess'
    WHEN 'steward' THEN 'Hostess'
    WHEN 'hostesssteward' THEN 'Hostess'
    WHEN 'addettoaccoglienza' THEN 'Hostess'
    WHEN 'addettosala' THEN 'Addetto sala'
    WHEN 'addettobanco' THEN 'Addetto banco'
    WHEN 'banconista' THEN 'Addetto banco'
    WHEN 'addettocassa' THEN 'Addetto banco'
    WHEN 'addettocucina' THEN 'Addetto cucina'
    WHEN 'pizzaiolo' THEN 'Pizzaiolo'
    WHEN 'pizzaiola' THEN 'Pizzaiolo'
    WHEN 'responsabiledisala' THEN 'Responsabile di sala'
    WHEN 'responsabilesala' THEN 'Responsabile di sala'
    WHEN 'sommelier' THEN 'Sommelier'
    WHEN 'addettocatering' THEN 'Addetto catering'
    WHEN 'receptionist' THEN 'Receptionist'
    WHEN 'reception' THEN 'Receptionist'
    WHEN 'sicurezzacontrolloaccessi' THEN 'Sicurezza / controllo accessi'
    WHEN 'sicurezza' THEN 'Sicurezza / controllo accessi'
    WHEN 'djintrattenimento' THEN 'DJ / intrattenimento'
    WHEN 'djeintrattenimento' THEN 'DJ / intrattenimento'
    WHEN 'dj' THEN 'DJ / intrattenimento'
    WHEN 'intrattenimento' THEN 'DJ / intrattenimento'
    WHEN 'djentertainment' THEN 'DJ / intrattenimento'
    WHEN 'animatoreeventi' THEN 'Animatore eventi'
    WHEN 'animatore' THEN 'Animatore eventi'
    ELSE _value
  END
  FROM (
    SELECT translate(coalesce(_value, ''), 'àáâäãèéêëìíîïòóôöõùúûüçÀÁÂÄÃÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC') AS unaccent_fallback
  ) s;
$$;

UPDATE public.profiles
SET primary_role = public.canonical_job_role(primary_role)
WHERE primary_role IS NOT NULL
  AND primary_role <> public.canonical_job_role(primary_role);

UPDATE public.profiles p
SET secondary_roles = sub.roles
FROM (
  SELECT id,
         ARRAY(SELECT DISTINCT public.canonical_job_role(r) FROM unnest(secondary_roles) AS r WHERE r IS NOT NULL AND btrim(r) <> '') AS roles
  FROM public.profiles
  WHERE secondary_roles IS NOT NULL
) sub
WHERE p.id = sub.id
  AND p.secondary_roles IS DISTINCT FROM sub.roles;

UPDATE public.announcements
SET professional_profile = public.canonical_job_role(professional_profile)
WHERE professional_profile IS NOT NULL
  AND professional_profile <> public.canonical_job_role(professional_profile);