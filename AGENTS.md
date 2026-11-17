# Project rules

- Suggestions use authenticated server submissions and admin-only RLS reads; reuse the invitation across home/dashboard — why: comments must reach a private, durable owner inbox.

- Keep homepage testimonials in HomeReviews with independent, accessible role carousels; label unconfirmed testimonial provenance as examples — why: role distinction and motion controls must not imply verified endorsements.

- Use Embla Auto Scroll for continuous testimonial motion with opposite role directions; keep pause, interaction stops and reduced-motion support — why: seamless loops must remain readable and controllable.

- Direct proposal compensation uses the shared proposal-compensation helper and consent notice; persist accepted hourly pay on applications.proposed_tariff, never alter the shared announcement — why: each worker can agree a different rate without changing other candidates' terms.

- Keep shared navigation collapsed below 2xl and use shrink-safe grids for mobile headers and action rows; size mobile dialogs with dynamic viewport units — why: both role menus exceed tablet widths and fixed save actions must remain fully visible.

- Social OAuth returns to the public /auth page; its session-aware effect waits for role/profile hydration before navigating — why: returning to / leaves full-page Google signups stranded on the homepage.

- Separate worker map markers in screen space at each zoom using map-marker-layout; keep sanitized geographic coordinates unchanged to preserve privacy and make overlapping workers selectable.

- Enable worker-photo enlargement through the optional UserAvatar zoomable prop; reuse the authorized avatar URL and leave other avatar uses unchanged.

- Share the reputation-level explanation between worker badges and the dashboard through ReputationLevelsExplanation so eligibility descriptions stay consistent without changing scoring logic.

- Use the shared CurriculumStars display for CV star ratings across owner and public views so dashboard and profile stay consistent.

- Resolve cross-user avatar paths through public_profiles as the viewer, then sign only owner-validated private avatar paths server-side; owner-only profile reads otherwise silently omit restaurant-visible worker photos.

- Restaurant availability views use sanitized calendar-override reads independent of the legacy special-availability flag; share the full dated list across search details and profiles so no saved dates are hidden by preview truncation.

- Edit calendar availability as date overrides through an atomic owner-scoped RPC; keep weekly rows as a read fallback and copy only explicitly selected dates, so a later single-date edit cannot change other weekdays or months.

- Keep CV assessments outside reviews/reputation; server-side AI completes consented assessments without manual approval, authorized only for the owner-worker or admin. New requests explicitly consent to automatic eligible publication; legacy private results require version-checked owner opt-in, so old analysis consent never becomes publication consent. Use approved for automatic completed results without claiming human review. Dashboard uses owner RLS and restaurant views sanitized reads; reset visibility and publication consent on replacement, new request or withdrawal to prevent stale publication.

- New CV uploads are scored in memory by scoreCurriculumPdf and never written to storage; only the result goes to worker_cv_pending_scores, and the worker accepts (accept_pending_curriculum_score copies it into worker_curriculum_assessments with a memory: path) or discards it — why: the PDF must never be retained and the score needs worker consent.

- Keep residence region/province selectors separate from operational-area configuration; onboarding start-city rules are narrower than job geography, so national residence choices never authorize a work area.
- Restrict direct reads of launch-area configuration tables to admins; ordinary selectors use the shared catalogue and existing validation RPCs, so signup cannot expose administrative configuration.

- External read-only KPI feed lives at `src/routes/api/public/jarvis-kpi.ts`, gated by the `X-Jarvis-Key` header vs the `JARVIS_KPI_KEY` secret and returning only aggregates — why: internal dashboard access without exposing PII or adding DB objects.
- Referral linking happens in the database (`handle_new_user` reads `referral_code` from signup metadata; OAuth calls `register_referral` after role claim) via `_link_referral`, independent of the UI feature flag; only the credit award checks the flag — why: links must never depend on client sessions or UI visibility.
- Homepage explainer videos are configured only in `src/lib/home-videos.ts` (null = honest "Video in arrivo" poster) — why: real sources can be added without touching the page and fake players are never shown.
- CV scoring is allowed only while worker_received_review is false; the first restaurant_to_worker review stales the CV assessment via trigger and get_worker_curriculum_rating hides it — why: real review stars replace the Pupillo CV score. Legacy stored PDFs keep the old purge path.
- ID document collection is disabled in code (onboarding section off, upload server fn refuses); keep the `require_id_document` flag off, historical documents are retained, not mass-deleted.
- A new self-editable profile column must be added to BOTH `update_my_profile` allowlist and `profiles_guard_admin_columns` allowlist; verify with `scripts/e2e-onboarding-save.ts` (creates and deletes dedicated test users) — missing either silently breaks onboarding "Salva".
- Notification emails are sent by a server sweep (`notification-email-sweep.server.ts`), never from the browser; `planNotificationEmail` decides which notifications are important, each notification is marked via `email_status`, and per-user opt-outs live in `notification_email_preferences` — why: notifications are created by DB triggers, so a single idempotent sweep covers every source.
- Alias only the deep `entities/lib/*.js` paths to the hoisted v4 in vite.config.ts, never the bare `entities` package — why: htmlparser2 needs its nested v7 (`entities/decode`).

- Profile completion uses Cloud Auth email OTP with server-only confirmation fields; never set phone_verified from email or accept fixed test codes, so contact completion cannot claim phone ownership. Preserve legacy phone completion and phone-based reputation/referral checks.
- Persist contact phone immutability in a server-only timestamp and enforce it in the profile trigger and onboarding; keep it independent of email confirmation resets so changing email cannot unlock the contact number.
- Version curriculum recognition rules in rubric_version and enforce matching publication checks in TypeScript and SQL; retain legacy rubric behavior and never retroactively rewrite scores or consent. Sanitize account-role labels before selecting an assessment occupation.
- Preserve the worker's explicit overall restaurant-review rating in the database trigger; resolve author roles before the later direction trigger, while restaurant-to-worker reviews retain the five-criterion average — why: detail criteria must not overwrite the worker's selected stars.
- Scheduled hooks under src/routes/api/public/hooks/ authenticate only via authenticateCronRequest with managed HTTP schedules; never accept the publishable key — why: it is public, so anyone could trigger expirations and emails.
- Stripe checkout requires requireSupabaseAuth and takes userId/email only from the verified session — why: client-supplied ids let anyone relink another profile's billing customer.
- Free recall: accept_application_atomic charges 7 credits only for the first paid confirmation of a restaurant–worker pair (restaurant_already_acquired_worker), writing a delta-0 audit row for recalls; the server decides, never the browser balance check — why: the business model promises unlimited free recalls.
