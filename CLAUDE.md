@AGENTS.md

# Marketing Beats — project context for Claude Code

In-house Asana replacement for Square Yards' marketing org, built for CMO Divya
Krishnan. Maintained by Diva Bindal with Claude. **This is a live production
tool in active pilot (~30 real users)** — no room for error, no fake data, no
"looks done but isn't". Verify claims against the live DB before stating them.

## Live infrastructure

- Production: https://marketing-beats-divabindal-webs-projects.vercel.app
- Deploy: push to `main` on github.com/divabindal-web/marketing-beats →
  Vercel auto-deploys production in ~40s (project `marketing-beats`, team
  `divabindal-webs-projects`).
- Backend: Supabase project `dabrsiqvprdihegbpefk` (Mumbai). Postgres + Auth
  (email/password) + Storage (`attachments` bucket, signed URLs) + RLS.
- Local dev: create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy values from Vercel → project →
  Settings → Environment Variables), then `npm install && npm run dev`.
- ALWAYS run `npm run build` (it type-checks) before pushing. A broken push
  takes production down with it.

## Domain model (key tables)

- `users` — 69 members. Fields: team, is_lead, role ('admin' = Divya),
  is_active, email (UNIQUE, always @squareyards.in lowercase).
- `requests` — design tasks. entity CHECK (SQY/INCO/UM/AZURO), current_stage,
  assigned_to/requestor_id → users. Children CASCADE on delete:
  stage_transitions, subtasks, comments, attachments, notifications.
- `stage_transitions` — append-only; TAT is computed from these.
- `perf_metric_series` — (domain, entity, metric, month, value, baseline,
  target) UNIQUE on (domain,entity,metric,month); feeds SEO/ORM/Paid/Social
  dashboards; CSV upsert via /performance-data/upload.
- `social_calendar` — calendar entries, request_id ON DELETE SET NULL.
- `notifications` — in-app only (bell in top bar); DB triggers on assignment
  and comments. NO email notifications (explicit CMO-side decision).

## Role model (enforced in UI + RLS — keep both in sync)

- Divya (role='admin'): assigns new requests to the 4 team leads; sees
  everything; manager dashboard by default; full User Management.
- Leads (is_lead=true): Lalit (Graphics & Video), Shivam (SEO), Param (Paid),
  Parth (Social). Assign only within their own team; manager view scoped to
  their team; can delete requests (RLS DELETE policy checks is_lead/admin);
  add members locked to their own team.
- Members: individual dashboard + My Tasks only; cannot assign (no assign
  field in New Request; Assignment section read-only); no delete anywhere.
- Makers' word is final — there is NO approval workflow, by design.
- TEAMS list lives in `src/lib/work-api.ts` (also: Azuro Marketing, Branding,
  Content, Research).

## Conventions & gotchas

- Design system: gb-* classes (gb-card, gb-btn, gb-stat-card, gb-table…) +
  input-base. Match them; light AND dark mode must both work.
- `currentDbUser()` in work-api.ts is the single source of "who am I" —
  cached per auth email, never caches null. Do not add module-level identity
  caches elsewhere (caused a real bug: stale identity after account switch).
- Supabase errors are NOT Error instances — always surface `error.message`,
  map 23505 to a friendly duplicate message, check session before writes.
- `sample-data.ts` users bridge to DB users by email — keep all emails
  lowercase @squareyards.in in both places.
- Auth "Keep this device logged in": custom storage adapter in
  `src/lib/supabase.ts` (localStorage vs sessionStorage keyed by
  mb-remember-device). Change password lives in the sidebar user menu.
- Destructive actions always use a two-step inline confirm (never window
  .confirm) and are gated to leads/admins in UI AND enforced by RLS.
- Delete ALL test data you create, in the same session you create it.

## QA — run before every ship

API-level CRUD matrix with supabase-js against the live project using
throwaway fixture accounts (create via SQL: auth.users rows need ''-defaults
for confirmation_token etc. or GoTrue 500s), then delete the fixtures fully
(public.users, auth.identities, auth.sessions, auth.refresh_tokens,
auth.users). Cover: both role logins, request create/delete, member-delete
blocked by RLS, subtasks/comments, duplicate email, member lifecycle,
notification trigger. Last full run: 18/18 pass (29 Jul 2026).

## Backlog (agreed candidates, not started)

Hootsuite weekly-CSV-email ingestion · Monday CMO digest · priority field +
stage-aging flags · mobile/responsive pass · rotate the shared pilot password
before wide rollout · tighten users-table RLS (currently permissive) · raise
Supabase refresh-token reuse interval (dashboard-only setting).
