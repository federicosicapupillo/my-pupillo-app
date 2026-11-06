# Project rules

- Keep CV assessments outside reviews/reputation; only server-side AI produces proposals and an admin RPC publishes them after owner consent, using version checks and sanitized reads so replacing/revoking a CV removes its badge.

- Store optional worker curricula separately from profile completion fields in private owner-only storage; validate PDF bytes server-side and keep upload independent of onboarding completion.

- Keep residence region/province selectors separate from operational-area configuration; onboarding start-city rules are narrower than job geography, so national residence choices never authorize a work area.

- External read-only KPI feed lives at `src/routes/api/public/jarvis-kpi.ts`, gated by the `X-Jarvis-Key` header vs the `JARVIS_KPI_KEY` secret and returning only aggregates — why: internal dashboard access without exposing PII or adding DB objects.
- Referral linking happens in the database (`handle_new_user` reads `referral_code` from signup metadata; OAuth calls `register_referral` after role claim) via `_link_referral`, independent of the UI feature flag; only the credit award checks the flag — why: links must never depend on client sessions or UI visibility.
- Homepage explainer videos are configured only in `src/lib/home-videos.ts` (null = honest "Video in arrivo" poster) — why: real sources can be added without touching the page and fake players are never shown.
