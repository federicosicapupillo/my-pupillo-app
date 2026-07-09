INSERT INTO public.feature_flags (key, enabled, scope, description)
VALUES (
  'available_now_enabled',
  false,
  'global',
  'Mostra la sezione "Disponibile ora" nel profilo/disponibilità del lavoratore. Se spento, la sezione è nascosta ovunque nell''app.'
)
ON CONFLICT (key) DO NOTHING;