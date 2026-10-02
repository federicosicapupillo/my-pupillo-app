# Project rules

- External read-only KPI feed lives at `src/routes/api/public/jarvis-kpi.ts`, gated by the `X-Jarvis-Key` header vs the `JARVIS_KPI_KEY` secret and returning only aggregates — why: internal dashboard access without exposing PII or adding DB objects.
- Referral linking happens in the database (`handle_new_user` reads `referral_code` from signup metadata; OAuth calls `register_referral` after role claim) via `_link_referral`, independent of the UI feature flag; only the credit award checks the flag — why: links must never depend on client sessions or UI visibility.
