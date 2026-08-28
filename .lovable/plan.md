# Audit funzionale read-only di Pupillo

Obiettivo: produrre un report tecnico dettagliato dello stato ATTUALE (codice + schema DB in sola lettura), senza modificare nulla.

## Cosa NON verrà toccato
Nessuna modifica a codice, migrazioni, database, dati, configurazioni o feature flags. Solo letture (file, `SELECT`, ispezione definizioni funzioni/trigger/policy).

## Deliverable
Un unico documento `/mnt/documents/PUPILLO_AUDIT_<data>.md` (scaricabile), con i 26 punti richiesti, ciascuna voce classificata come:
IMPLEMENTATO / IMPLEMENTATO DA VERIFICARE / DISABILITATO-FLAG OFF / IN SVILUPPO / PIANIFICATO / DEPRECATO.
Ogni affermazione avrà riferimento a file:riga o nome di funzione/trigger/policy. Le incertezze verranno elencate esplicitamente in una sezione "Punti non verificabili / dubbi", senza colmarle con ipotesi.

## Metodo di raccolta
1. Codice frontend: tutte le 45 route in `src/routes`, `AppShell`, `RequireAuth`, `RequireRole`, gate onboarding, e i ~128 moduli in `src/lib` (job roles, expiry, conflitti turni, crediti, recensioni, launch area, feature flags hooks).
2. Backend applicativo: `*.functions.ts` (server functions), route API pubbliche (`api/public/*`), integrazione auth/Supabase.
3. Database (sola lettura): elenco tabelle e colonne, enum, policy RLS e GRANT, definizioni complete di trigger e funzioni critiche (`accept_application_atomic`, `consume_credits`, `handle_new_user`, `get_shift_review_status`, notifiche/dedupe, conflitti turno, launch area, moderazione), più il contenuto attuale di `feature_flags` / `feature_flag_cities` (chiavi esatte, valore, scope) e conteggi aggregati non sensibili.
4. Test presenti (`src/**/__tests__`, e2e) per capire cosa è coperto e cosa segnalano come noto.
5. Confronto `docs/*.md` vs codice, con il codice più recente considerato authoritative.

## Struttura del report
- Sintesi esecutiva + tabella di stato per area.
- Sezioni 1–26 nell'ordine richiesto.
- State machine esplicite (announcement, application, proposal, shift, review, credit) ricostruite da enum + trigger + UI.
- Inventario feature flags con effetto reale a OFF.
- Inventario tabelle/colonne principali e trigger/RPC critici.
- Bug, TODO e codice morto/disattivato rilevati.
- Discrepanze documentazione vs codice.
- Elenco incertezze.

## Esecuzione
Il lavoro verrà parallelizzato su sotto-agenti di sola lettura per area (frontend/route, DB/trigger, notifiche+recensioni, crediti+pagamenti+flag, docs-vs-codice) e poi consolidato in un unico documento coerente.
