# Project rules

- Edit calendar availability as date overrides through an atomic owner-scoped RPC; keep weekly rows as a read fallback and copy only explicitly selected dates, so a later single-date edit cannot change other weekdays or months.

- Keep CV assessments outside reviews/reputation; server-side AI completes consented assessments without manual approval, authorized only for the owner-worker or admin. New requests explicitly consent to automatic eligible publication; legacy private results require version-checked owner opt-in, so old analysis consent never becomes publication consent. Use approved for automatic completed results without claiming human review. Dashboard uses owner RLS and restaurant views sanitized reads; reset visibility and publication consent on replacement, new request or withdrawal to prevent stale publication.

- Store optional worker curricula separately from profile completion fields in private owner-only storage; validate PDF bytes server-side and keep upload independent of onboarding completion.

- Keep residence region/province selectors separate from operational-area configuration; onboarding start-city rules are narrower than job geography, so national residence choices never authorize a work area.

- External read-only KPI feed lives at `src/routes/api/public/jarvis-kpi.ts`, gated by the `X-Jarvis-Key` header vs the `JARVIS_KPI_KEY` secret and returning only aggregates — why: internal dashboard access without exposing PII or adding DB objects.
- Referral linking happens in the database (`handle_new_user` reads `referral_code` from signup metadata; OAuth calls `register_referral` after role claim) via `_link_referral`, independent of the UI feature flag; only the credit award checks the flag — why: links must never depend on client sessions or UI visibility.
- Homepage explainer videos are configured only in `src/lib/home-videos.ts` (null = honest "Video in arrivo" poster) — why: real sources can be added without touching the page and fake players are never shown.
