
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS license_requirement text,
  ADD COLUMN IF NOT EXISTS language_requirements text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tattoos_allowed text,
  ADD COLUMN IF NOT EXISTS piercings_allowed text,
  ADD COLUMN IF NOT EXISTS beard_allowed text,
  ADD COLUMN IF NOT EXISTS required_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dress_code_items text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dress_code_notes text;

-- Demo data per ruolo
UPDATE public.announcements SET
  license_requirement = 'nessuna',
  language_requirements = ARRAY['italiano','inglese_base'],
  tattoos_allowed = 'solo_non_visibili',
  piercings_allowed = 'solo_discreti',
  beard_allowed = 'solo_curata',
  required_skills = ARRAY['saper_portare_tre_piatti','servizio_al_tavolo','uso_palmare'],
  dress_code_items = ARRAY['camicia_bianca','pantalone_nero','scarpe_nere','cintura_nera','penna'],
  dress_code_notes = 'Camicia bianca senza loghi e pantalone nero elegante. Portare penna e accendino.'
WHERE professional_profile ILIKE 'cameriere' AND dress_code_items IS NULL OR dress_code_items = '{}';

UPDATE public.announcements SET
  license_requirement = 'nessuna',
  language_requirements = ARRAY['italiano','inglese_base'],
  tattoos_allowed = 'indifferente',
  piercings_allowed = 'solo_discreti',
  beard_allowed = 'solo_curata',
  required_skills = ARRAY['preparazione_cocktail','preparazione_caffetteria','gestione_cassa'],
  dress_code_items = ARRAY['camicia_bianca','grembiule_nero','scarpe_nere','cavatappi','accendino','penna'],
  dress_code_notes = 'Total black, cavatappi e accendino sempre con sé.'
WHERE professional_profile ILIKE 'bartender' OR professional_profile ILIKE 'barista';

UPDATE public.announcements SET
  license_requirement = 'automunito',
  language_requirements = ARRAY['italiano'],
  tattoos_allowed = 'indifferente',
  piercings_allowed = 'no',
  beard_allowed = 'solo_curata',
  required_skills = ARRAY['servizio_al_tavolo','saper_portare_tre_piatti'],
  dress_code_items = ARRAY['scarpe_nere','total_black','calze_lunghe_nere'],
  dress_code_notes = 'Puntualità richiesta. Abbigliamento total black.'
WHERE professional_profile ILIKE 'runner';

UPDATE public.announcements SET
  license_requirement = 'nessuna',
  language_requirements = ARRAY['italiano','inglese_intermedio'],
  tattoos_allowed = 'solo_non_visibili',
  piercings_allowed = 'no',
  beard_allowed = 'solo_curata',
  required_skills = ARRAY['gestione_sala','uso_palmare','servizio_al_tavolo','fine_dining'],
  dress_code_items = ARRAY['camicia_bianca','cravatta_nera','pantalone_nero','scarpe_nere','cintura_nera'],
  dress_code_notes = 'Dress code elegante richiesto. Camicia bianca e cravatta nera senza loghi.'
WHERE professional_profile ILIKE '%responsabile%' OR professional_profile ILIKE 'hostess';

UPDATE public.announcements SET
  license_requirement = 'nessuna',
  language_requirements = ARRAY['italiano'],
  tattoos_allowed = 'indifferente',
  piercings_allowed = 'no',
  beard_allowed = 'no',
  required_skills = ARRAY['banqueting','fine_dining'],
  dress_code_items = ARRAY['divisa_fornita','scarpe_nere','capelli_raccolti','no_profumi'],
  dress_code_notes = 'Divisa fornita dal locale. Capelli raccolti.'
WHERE professional_profile ILIKE 'chef' OR professional_profile ILIKE 'aiuto%cucina' OR professional_profile ILIKE 'lavapiatti' OR professional_profile ILIKE 'pizzaiolo';

-- Fallback per annunci demo rimasti senza requisiti
UPDATE public.announcements SET
  license_requirement = COALESCE(license_requirement, 'nessuna'),
  language_requirements = CASE WHEN array_length(language_requirements,1) IS NULL THEN ARRAY['italiano'] ELSE language_requirements END,
  tattoos_allowed = COALESCE(tattoos_allowed, 'indifferente'),
  piercings_allowed = COALESCE(piercings_allowed, 'indifferente'),
  beard_allowed = COALESCE(beard_allowed, 'solo_curata'),
  required_skills = CASE WHEN array_length(required_skills,1) IS NULL THEN ARRAY['servizio_al_tavolo'] ELSE required_skills END,
  dress_code_items = CASE WHEN array_length(dress_code_items,1) IS NULL THEN ARRAY['total_black','scarpe_nere'] ELSE dress_code_items END,
  dress_code_notes = COALESCE(dress_code_notes, 'Abbigliamento ordinato e professionale.')
WHERE status IN ('active','assigned','draft');
