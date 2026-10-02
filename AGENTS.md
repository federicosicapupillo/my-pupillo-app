# Project rules

- External read-only KPI feed lives at `src/routes/api/public/jarvis-kpi.ts`, gated by the `X-Jarvis-Key` header vs the `JARVIS_KPI_KEY` secret and returning only aggregates — why: internal dashboard access without exposing PII or adding DB objects.
