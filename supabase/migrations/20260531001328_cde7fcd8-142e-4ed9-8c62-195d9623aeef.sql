-- Cambia il tipo di experience_years da integer a text per supportare opzioni testuali
ALTER TABLE public.profiles ALTER COLUMN experience_years TYPE text;

-- Nota: i valori numerici esistenti verranno automaticamente convertiti in testo
-- (es. 2 diventa "2") senza perdita di dati.