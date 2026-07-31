# QA Test Plan — Pre-Deployment Manual Checklist

No automated test suite exists yet (see `CLAUDE.md`), so this is a manual walkthrough covering the app's full functionality. Run through it end-to-end before any major deployment. Test with all four roles: `ADMIN`, `COACH`, `RECEP`, `CLIENTE`.

Legend: **P0** = blocks deployment if broken · **P1** = should fix before deploy · **P2** = note and follow up later.

---

## 1. Auth & Session

- [ ] **P0** Login with valid email/password for each of the 4 demo roles → lands on correct home (`/dashboard` for staff, `/mi/resumen` for CLIENTE).
- [ ] **P0** Login with wrong password → generic error, no user enumeration.
- [ ] **P0** 5 consecutive failed logins on one account → 6th attempt (even correct password) returns `423 ACCOUNT_LOCKED`; account unlocks after 15 min or stays locked before that.
- [ ] **P1** Successful login resets `failedAttempts` counter (4 failures + 1 success + 5 more failures should NOT lock immediately on the 5th of the second batch... actually confirm counter resets to 0 after success).
- [ ] **P1** Login rate limit: 5 failed attempts across the *global* 15-min window from one IP → `429`, independent of which account is targeted (`authLimiter` is IP-scoped, `skipSuccessfulRequests: true`).
- [ ] **P1** Registration (`/login` → "Crear cuenta"): full happy path creates a CLIENTE, starting `estado = 'Por vencer'` regardless of plan chosen, and an initial "peso" medida is recorded from `inscripcion.peso`.
- [ ] **P1** Registration: 3 registrations from same IP within an hour succeed, 4th returns `429` (separate `registerLimiter`, 3/hour).
- [ ] **P2** Registration: password missing upper/lower/digit → rejected client + server side; `aceptoResponsiva=false` is accepted by the *backend* schema (only a `.refine` client-side) — verify the client-side form actually blocks submission, since the server alone would allow it.
- [ ] **P0** Refresh flow: after access-token expiry (or forced), page reload keeps the session alive via the httpOnly refresh cookie (no re-login needed within 7 days).
- [ ] **P0** Refresh token is rotated on every `/auth/refresh` call; replaying an old (already-rotated) refresh token returns `401 REFRESH_REVOKED`.
- [ ] **P0** ⚠️ **Verify `cid` survives refresh**: log in as CLIENTE, force a token refresh (wait past access-token TTL or trigger manually), then hit any `/mi/*` page. `refresh()`'s newly-issued access token may omit the `cid` claim — if so, client-portal calls would fail with `NO_CLIENTE_LINKED` after a refresh even though the session looks valid. This is a suspected bug from code review — confirm behavior and file a bug if reproduced.
- [ ] **P0** Logout clears session both client-side (memory) and server-side (cookie + revoked refresh token); back button after logout doesn't restore access.
- [ ] **P1** CSRF: mutating request (e.g. edit a cliente) without `X-CSRF-Token` header → rejected. With *any* non-empty header value (not matching the real cookie) → currently **succeeds**, since `requireCsrf` only checks presence, not that it matches the `csrfToken` cookie. Confirm this and flag to devs as a security gap (real protection currently relies on CORS/browser same-origin, not double-submit matching).
- [ ] **P1** Google OAuth: login button visible only when `VITE_GOOGLE_CLIENT_ID` is set; if backend `GOOGLE_CLIENT_ID` is unset, `/auth/google` returns `503 GOOGLE_AUTH_DISABLED`.
- [ ] **P1** Google OAuth: sign in with a Google account whose email has **no** matching `gym_users` record → `404 NO_ACCOUNT`, UI shows "no encontramos una cuenta" + "Crear cuenta" link (never auto-creates).
- [ ] **P1** Google OAuth: sign in with a Google account matching an existing password-only account → succeeds, silently sets `googleId`/`oauthProvider` (verify via a second Google login that it no longer re-links / still works).
- [ ] **P2** Google OAuth: sign in to a *locked* account → `423`, same as password login.
- [ ] **P1** Google OAuth: email not verified on the Google side → `401 GOOGLE_EMAIL_UNVERIFIED`.

## 2. RBAC / Route Guard Matrix

Test by directly navigating (typing URL) as each role, not just clicking nav links — nav hiding and route guarding are separate mechanisms.

- [ ] **P0** ADMIN can reach: `/dashboard`, `/clientes/*`, `/inventario`, `/nomina`, `/gastos`, `/ingresos`, `/creditos`, `/rutinas/clientes`, `/rutinas/coach`, `/admin/contenido`.
- [ ] **P0** COACH can reach: `/dashboard`, `/clientes/*`, `/rutinas/clientes`, `/rutinas/coach`. Direct navigation to `/inventario`, `/nomina`, `/gastos`, `/ingresos`, `/creditos`, `/admin/contenido` redirects to `/dashboard` (not a blank/error page).
- [ ] **P0** RECEP can reach: `/dashboard`, `/clientes/*` only. All other staff-only URLs redirect to `/dashboard`.
- [ ] **P0** CLIENTE can reach only `/mi/*`. Direct navigation to any staff URL (e.g. `/dashboard`) redirects to `/mi/resumen`.
- [ ] **P1** Sidebar links match the route guard per role — e.g. confirm COACH's sidebar doesn't show a dead link to Inventario/Nómina (per code review, `NAV_ITEMS` role-filtering in `Sidebar.jsx` should hide these; worth a visual check per role).
- [ ] **P0** Logged-out user hitting any protected URL → redirected to `/login?next=<original path>`, and after logging in lands back on that original path.
- [ ] **P1** `/admin/contenido` API calls (`PUT /settings/admin/*`) attempted directly as COACH/RECEP (e.g. via devtools) return `403`, not just UI-hidden.

## 3. Staff: Clientes (`/clientes`)

- [ ] **P0** List loads, search/filter by name/plan/estado works, pagination/limit behaves for large lists.
- [ ] **P0** Create cliente (ADMIN/RECEP) — required fields enforced: nombre, email, `inscripcion.peso`, `inscripcion.habitos.aceptoResponsiva`. COACH cannot create (403/hidden).
- [ ] **P1** Create with legacy plan values (`Básico`/`Premium`/`Elite`) still accepted (back-compat).
- [ ] **P0** Edit cliente (ADMIN/RECEP) — partial update doesn't clobber unrelated fields; changing `plan` doesn't silently reset `tipoMensualidad` or vice versa.
- [ ] **P0** Delete cliente (ADMIN only) — RECEP/COACH cannot delete. Confirm cascading effects (or lack thereof) on that client's pagos/rutinas/recordatorios.
- [ ] **P2** Editing a client's `vencimiento`/`estado` updates their membership status view correctly in both staff and client portal.

## 4. Staff: Pagos, Inventario, Nómina, Gastos, Ingresos

- [ ] **P0** Pagos: create a payment (ADMIN/RECEP), `clienteId` uuid required, `monto` positive ≤1,000,000, `metodo` enum, `cardLast4` 4-digit regex when card selected.
- [ ] **P0** Inventario: CRUD gated to ADMIN only; `cantidad`/`minimo` int bounds (0–10000), `precio` bounds (0–1,000,000) enforced.
- [ ] **P0** Nómina: entire section ADMIN-only end to end (list, create, "pagar" action). `horas` bounded 0–744.
- [ ] **P0** Gastos / Ingresos: CRUD ADMIN-only; `metodo` enum differs between the two (Ingresos adds `Mixto`) — verify each form offers the right options.
- [ ] **P1** Dashboard summary (`/dashboard`) numbers reconcile with the underlying pagos/gastos/ingresos records after CRUD changes above.

## 5. Staff: Créditos

- [ ] **P0** Create a crédito via UI — `legacyUsuario` (free-text name) required, saves and displays correctly in the list.
- [ ] **P1** A crédito originally imported with a `clienteId` FK (if any legacy data exists in the target environment) still resolves to the correct client name.
- [ ] **P2** A crédito whose linked `clienteId` no longer exists in `gym_clientes` (deleted client) displays "Sin nombre" gracefully instead of erroring.
- [ ] **P0** Edit/delete gated ADMIN-only.

## 6. Staff: Rutinas

- [ ] **P0** Coach creates a rutina template (`/rutinas/coach`) — `nivel` enum, `dias` (max 7) with exercises (max 15 each) saves correctly.
- [ ] **P0** Edit/delete a coach template — verify effect on clients who've self-assigned it (see next section).
- [ ] **P1** Staff assigns a rutina to a specific client directly (`/rutinas/clientes`) — appears correctly in that client's "Mis Rutinas".
- [ ] **P1** Only ADMIN/COACH can create/edit/delete templates or assignments; RECEP is fully blocked from `/rutinas/*`.

## 7. Admin: Backoffice Contenido (`/admin/contenido`)

- [ ] **P0** Packages tab: add/edit/remove a package, save, verify it reflects on the public `/` landing page immediately.
- [ ] **P1** Package `periodo` dropdown only offers `trimestre/semestre/anualidad` — confirm editing/re-saving a default package that uses `periodo: 'mes'` (e.g. "Mensual") through this UI doesn't accidentally change its periodo, since "mes" isn't a selectable option. Flag as a UI gap if reproduced.
- [ ] **P0** Coaches tab: add/edit/remove a coach; image upload via "Subir foto" — valid JPEG/PNG/WEBP/GIF under 5MB succeeds and auto-fills the URL; oversized file and disallowed MIME type (e.g. PDF, SVG) are rejected with a clear error, not a silent failure.
- [ ] **P1** Uploaded coach images are reachable at `/uploads/coaches/<file>` without auth (expected — confirm it's intentional, not a leak of anything sensitive).
- [ ] **P0** Schedule tab: add/remove class types (with colors), edit the day/time grid, save; verify it renders correctly on the public landing page schedule section.
- [ ] **P1** Deleting a class type that's referenced in existing schedule cells doesn't crash — cells referencing it should clear/null out.
- [ ] **P2** Confirm `promotions` and `calendar` settings have no admin UI (only reachable via direct API) — decide if that's acceptable for this release or needs a follow-up ticket.
- [ ] **P1** Malformed/edge-case input in any of the three tabs (e.g. duplicate day names, blank time slot, non-hex color text) doesn't break the save or the public landing page render — these endpoints have no server-side Zod validation, so bad data is only as safe as the client + landing-page rendering handles it.
- [ ] **P0** Non-ADMIN roles cannot reach `/admin/contenido` or call its PUT endpoints (see §2).

## 8. Public Landing Page (`/`, logged out)

- [ ] **P0** Loads with real data from `gym_settings` (packages, coaches, schedule) once configured via backoffice.
- [ ] **P1** If any one section (e.g. coaches) is emptied out via the admin editor, that section falls back to sane hardcoded defaults rather than rendering blank — confirm per section (packages/coaches/schedule).
- [ ] **P1** Visiting `/` while already logged in redirects straight to the correct role home, does not show the marketing page.
- [ ] **P2** Privacy notice page (`/aviso-de-privacidad` or `/privacidad`) loads standalone, linked from landing page and registration form.

## 9. Client Portal (`/mi/*`)

- [ ] **P0** Dashboard/resumen loads with correct client-specific data (no cross-client leakage — verify by comparing two different CLIENTE logins).
- [ ] **P0** Membresía page shows correct plan/estado/vencimiento matching what staff set.
- [ ] **P0** Mis Rutinas: client can browse the program library (`/cliente/programas`) and self-assign one (`POST /rutina/asignar`); assigned routine displays correctly.
- [ ] **P1** Coach edits the template a client has self-assigned → client's "Mis Rutinas" reflects the change immediately (no re-assignment needed), per the live-read (`conDiasVivas`) behavior.
- [ ] **P2** Coach *deletes* the assigned template → client still sees their last-known cached routine instead of an error/blank page.
- [ ] **P1** Client switches from one assigned program to a different one → the week counter resets to 1; re-selecting the same program preserves the counter.
- [ ] **P0** Diario/Workouts: log a workout (1–15 exercises, each with 1–20 sets, reps 0–500, peso 0–1000kg) — saves and lists correctly, `desde`/`hasta` date filters work.
- [ ] **P0** Medidas: log a measurement — at least one of peso/%grasa/%músculo/perímetros required (empty submission rejected with a clear message).
- [ ] **P1** Progreso/PRs page reflects newly logged workouts/medidas (charts or summaries update).
- [ ] **P0** A CLIENTE cannot access another client's data by manipulating IDs in requests — all `/cliente/*` endpoints scope strictly to the JWT's own `cid`, never accept a client-supplied ID (spot-check with devtools/network tab).

## 10. Completar Perfil (new feature — test thoroughly, this is unreleased)

- [ ] **P0** A CLIENTE whose stored profile is missing any of the "required" fields (apellido, telefono, fechaNacimiento, edad, genero, peso, grupoSanguineo, alergiaMedicamentos, emergencia contact, salud fields, habitos fields, aceptoPrivacidad, aceptoResponsiva) gets force-redirected from **any** `/mi/*` page to `/mi/completar-perfil` on login.
- [ ] **P0** While incomplete, the guard allows staying on `/mi/completar-perfil` itself (no redirect loop).
- [ ] **P0** A CLIENTE with a fully complete profile is **not** redirected and can navigate freely, including to `/mi/completar-perfil` itself (it doubles as an editable "Mi Perfil" page, reachable via nav at any time).
- [ ] **P0** Submitting the Completar Perfil form with all required fields succeeds, flips `perfilCompleto` to true immediately (optimistic, no page reload needed) and shows the confirmation screen with a link to `/mi/resumen`.
- [ ] **P1** Conditional-required fields work: `estudiante` checked → `matricula` becomes required; unchecked → not required. `actividadHabitual` checked → tipo/frecuencia/tiempo become required; unchecked → not required.
- [ ] **P1** "Sí/No" radio pairs (alergia, medicamento actual, otro padecimiento) — selecting "No" auto-fills `"Ninguna"`/`"Ninguno"` server-side even though the UI shows a toggle, not free text in that state; selecting "Sí" requires the detail textarea.
- [ ] **P0** aceptoPrivacidad and aceptoResponsiva checkboxes are hard-blocking — form won't submit unless both are checked.
- [ ] **P0** ⚠️ **Verify no data loss on save**: for a client with pre-existing `inscripcion` data (e.g. registered via the original form, or has `inscripcion.fecha`/other fields not present in the Completar Perfil form), submitting this form does a full `SET` overwrite of `inscripcion`, not a merge. Register a test client, note any extra `inscripcion` sub-fields (e.g. registration date), then submit Completar Perfil and confirm whether those fields survive. If they don't, this is a real data-loss bug worth flagging before shipping.
- [ ] **P1** ⚠️ A CLIENTE created via Google login (never went through the full registration questionnaire) who completes their profile with a weight does **not** get an automatic initial "peso" measurement entry (unlike `/auth/register`, which does create one). Confirm this gap is acceptable or needs a fix — otherwise their weight-progress chart will have no starting point.
- [ ] **P1** Server-side validation errors (e.g. submitting via a tampered request bypassing client validation) render the flattened `field: message` error list correctly, not a raw JSON dump or blank error.
- [ ] **P1** GET `/cliente/perfil` correctly hydrates the form on load for a partially-complete profile (e.g. some fields filled from original registration, others blank) — no crash on missing nested `inscripcion.emergencia`/`salud`/`habitos` sub-objects.

## 11. Cross-Cutting / Non-Functional

- [ ] **P0** Global rate limit (200 req/15min/IP) doesn't trip during normal manual QA usage, but does trip under a quick burst test (confirms it's live before relying on it in prod).
- [ ] **P1** Error responses consistently follow the documented shape (`error`, `code`, `details`, `requestId`) across at least one endpoint per major feature area.
- [ ] **P1** Production build (`npm run build` + `preview`) — smoke-test login and one page per role; confirm no `VITE_`-prefixed secrets leak into the built JS (grep the `dist/` bundle for anything unexpected).
- [ ] **P1** Stack traces are suppressed in prod-mode error responses (`IS_PROD` flag) — verify a forced 500 doesn't leak a stack trace to the client.
- [ ] **P2** Responsive check: staff dashboard and client portal both usable on a narrow (mobile) viewport, not just desktop.
- [ ] **P2** Winston logs redact `password`/`token`/`cc` fields — trigger a login and confirm the password isn't visible in server logs.
- [ ] **P1** CORS: confirm the production frontend origin is in `CORS_ORIGINS` and that an arbitrary third-party origin is rejected (preflight fails) against the deployed API.
- [ ] **P0** `COOKIE_SECURE=true` and cookies are `httpOnly`/`SameSite` appropriately in the production environment (not just local dev).

---

## Known Gaps Surfaced During Code Review (confirm impact, decide fix-now vs. follow-up)

These aren't fresh bugs to hunt for blind — they were spotted while inventorying the code for this checklist. Each has a corresponding test above; listed together here so they don't get lost as "someday" items:

1. **Refreshed access tokens may omit `cid`** — could silently break the client portal after a token refresh. (§1)
2. **CSRF header is checked for presence only, not matched against the cookie value** — the "double-submit" protection isn't actually verifying the two values match. (§1)
3. **`PUT /cliente/perfil` overwrites the entire `inscripcion` object** rather than merging — risk of silently dropping fields not present in the Completar Perfil form. (§10)
4. **No initial weight measurement created** when a Google-only user completes their profile with a weight (only `/auth/register` creates one). (§10)
5. **`settings.routes.js` admin PUT endpoints have no Zod validation** — malformed payloads are coerced/defaulted rather than rejected; landing page needs to degrade gracefully. (§7)
6. **Package `periodo` dropdown in Backoffice Contenido doesn't offer `mes`/`año`**, even though default seed packages use `mes`. (§7)
7. **`promotions` settings have no admin UI at all**, and `calendar` settings have a PUT route but no UI screen. (§7)

None of these are necessarily blockers — triage each against the confirm-test result and decide P0/P1/P2 accordingly.
