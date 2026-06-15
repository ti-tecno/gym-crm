# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

IronCore is a gym management system: a monorepo with a Node.js/Express backend (AWS DynamoDB) and a React/Vite frontend. It provides staff dashboards (admin, coaches, receptionists) and a separate client portal for gym members.

**Tech Stack:**
- **Backend**: Node.js 20+, Express, AWS DynamoDB (or DynamoDB Local), JWT RS256, Zod, Helmet, Winston; uses ES modules (`"type": "module"`)
- **Frontend**: React 18.3, Vite 5, React Router DOM, React Hook Form, Zod, DOMPurify, Axios; uses ES modules
- **Auth**: RS256 asymmetric JWT; access token (15 min) + refresh token (7 days, httpOnly cookie, rotated on every refresh)
- **RBAC Roles**: `ADMIN`, `COACH`, `RECEP` (staff portals), `CLIENTE` (member portal)

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env        # Edit: add AWS credentials or DYNAMODB_ENDPOINT for local dev
npm install
npm run keys:gen            # Generate RS256 JWT key pair → backend/keys/
npm run db:create           # Create DynamoDB tables
npm run db:seed             # Load demo data
npm run dev                 # Start on http://localhost:4000/api/v1
```

For local DynamoDB (Docker):
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
# Set DYNAMODB_ENDPOINT=http://localhost:8000 in .env
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # Start on http://localhost:5173
npm run build               # Production build
npm run preview -- --port 4173
```

### Demo Credentials (after seed)

| Email | Password | Role |
|-------|----------|------|
| admin@ironcore.mx | Admin#2026 | ADMIN |
| coach@ironcore.mx | Coach#2026 | COACH |
| recepcion@ironcore.mx | Recep#2026 | RECEP |
| carlos@email.com | Cliente#2026 | CLIENTE |

Clients can self-register via Login → "Crear cuenta" tab.

## Architecture

### Backend (`backend/src/`)

```
config/          env.js (Zod env validation), dynamo.js (DDB client + TABLES constant), logger.js (Winston)
middleware/      auth.js (JWT + RBAC + CSRF), errorHandler.js, rateLimiter.js, validate.js (Zod)
routes/          Express route modules; assembled in routes/index.js
controllers/     Request handlers; delegate to repos/services
services/        jwt.service.js, password.service.js
repositories/    DynamoDB queries; no ORM
validators/      Zod schemas applied via validate() middleware
scripts/         createTables.js, seed.js, clearSeed.js, generateKeys.js
```

**Flow**: Route → `requireAuth` + `requireRole` + `requireCsrf` + `validate(schema)` → Controller → Repository/Service

**Key naming distinction**: `clientes.routes.js` is the staff-facing client management API (`/api/v1/clientes`). `cliente.routes.js` is the self-service portal API for the `CLIENTE` role (`/api/v1/cliente`).

**Error response shape** (all errors follow this structure):
```json
{ "error": "...", "code": "SNAKE_CASE_CODE", "details": {...}, "requestId": "uuid" }
```

**Patterns:**
- DynamoDB queries always use `ExpressionAttributeNames` + `ExpressionAttributeValues` (no interpolation). Import `ddb` and `TABLES` from `config/dynamo.js`.
- All endpoints have a Zod schema applied at the middleware layer via `validate(schema)`
- Failed login attempts tracked; account locked after 5 failures for 15 min; bcrypt saltRounds=12
- Logs via Winston with automatic redaction of `password`, `token`, `cc` fields
- `HttpError(status, code, message)` is the standard way to pass errors to `next()`

### Frontend (`frontend/src/`)

```
context/AuthContext.jsx    useAuth() hook; login/logout/register/hasRole/isAccessValid
guards/ProtectedRoute.jsx  Role check + token expiry; redirects to /login if unauthorized
pages/                     Clientes/ (staff views), Cliente/ (member portal), plus top-level pages
components/layout/         Layout + Sidebar (staff), ClienteLayout + ClienteSidebar (member portal)
services/                  api.js (axios client with interceptors), *.service.js per domain
utils/                     tokenStore.js (in-memory JWT), sanitize.js (DOMPurify), safeRoute.js
constants/theme.js         ROLES enum, STAFF_ROLES array, color palette, NAV_ITEMS, CLIENTE_NAV_ITEMS
```

**Dual-layout routing**: `App.jsx` has two separate `<Route>` trees. Staff roles (`ADMIN`, `COACH`, `RECEP`) use `<Layout>` with `Sidebar`. `CLIENTE` uses `<ClienteLayout>` with `ClienteSidebar`. Routes under `/mi/*` are client-only; routes under `/dashboard`, `/clientes/*`, `/inventario`, `/nomina`, `/rutinas/*`, `/admin/*` are staff-only.

**Patterns:**
- JWT stored in memory only via `tokenStore.js` (never localStorage); on page reload, `AuthContext` bootstraps from the httpOnly refresh cookie
- Axios interceptor silently refreshes on 401 before retrying; injects Bearer + CSRF tokens
- CSRF double-submit: `csrfToken` cookie is readable by JS (not httpOnly) so the client reads it and sends it as `X-CSRF-Token` header on mutating requests
- All dynamic HTML passes through DOMPurify (`utils/sanitize.js`) before render
- Forms: React Hook Form + Zod resolver

### Data Model (DynamoDB tables, prefix `gym_`)

| Table | Partition Key | Notable GSIs |
|-------|---------------|--------------|
| `gym_users` | userId | email |
| `gym_clientes` | clienteId | email, estado |
| `gym_pagos` | pagoId | clienteId, fecha |
| `gym_inventario` | itemId | categoria |
| `gym_nomina` | empleadoId | estado |
| `gym_rutinas_clientes` | rutinaId | clienteId |
| `gym_rutinas_coach` | rutinaId | — |
| `gym_recordatorios` | recordatorioId | clienteId, estado |
| `gym_workouts` | workoutId | clienteId, fecha |
| `gym_medidas` | medidaId | clienteId, fecha |
| `gym_prs` | — | clienteId |
| `gym_settings` | — | — |
| `gym_refresh_tokens` | jti | — |
| `gym_login_attempts` | — | — |

## Adding a New Backend Endpoint

1. **Validator** `validators/feature.schema.js` — Zod schema
2. **Repository** `repositories/feature.repo.js` — DynamoDB queries using `ddb` and `TABLES` from `config/dynamo.js`
3. **Controller** `controllers/feature.controller.js` — calls repo, sends response, passes errors via `next(new HttpError(...))`
4. **Route** `routes/feature.routes.js` — wire `requireAuth`, `requireRole`, `requireCsrf` (on mutating routes), `validate(schema)`, controller
5. **Register** in `routes/index.js`: `router.use('/feature', featureRoutes)`

## Adding a Frontend Page

1. Create component in `pages/`
2. Add route in `App.jsx` inside the appropriate layout tree (`Layout` for staff, `ClienteLayout` for CLIENTE), wrapped with `<ProtectedRoute roles={[...]}>` for additional role checks
3. Add link in `components/layout/Sidebar.jsx` (staff) or `ClienteSidebar.jsx` (member) via `constants/theme.js` nav arrays
4. Create `services/feature.service.js` for API calls using the shared `api` axios instance from `services/api.js`

## Database Scripts

```bash
npm run db:create      # Create all tables (idempotent)
npm run db:seed        # Load demo data
npm run db:clear-seed  # Remove seeded data only (keeps tables)
npm run db:reset       # Drop + recreate all tables, then seed
```

No migration framework; schema changes require `db:reset`.

## Linting & Tests

No linting or test framework is configured yet. `package.json` has placeholder scripts. To add:
- **Linting**: `eslint` with `.eslintrc.json`
- **Backend tests**: `vitest` + `backend/src/**/*.test.js`
- **Frontend tests**: `vitest` + React Testing Library

## Key Environment Variables

See `backend/.env.example` for all variables. Critical ones:

| Variable | Purpose |
|----------|---------|
| `DYNAMODB_ENDPOINT` | Set to `http://localhost:8000` for local DDB |
| `AWS_REGION` | DynamoDB region |
| `JWT_PRIVATE_KEY_PATH` | Path to RS256 private key (generated by `keys:gen`) |
| `JWT_PUBLIC_KEY_PATH` | Path to RS256 public key |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `COOKIE_SECURE` | Set `true` in production (HTTPS only) |
| `VITE_API_URL` | (frontend) Backend base URL |

## Security Notes

- `docs/SECURITY-CHECKLIST.md` tracks pre-release items (HTTPS redirect, TLS 1.3, Secrets Manager, OWASP ZAP)
- Rate limiting: 200 req/15 min per IP globally; `/auth/login` stricter (5 attempts/15 min)
- Never add `VITE_` prefixed secrets — they are bundled into the frontend build
- Stack traces are suppressed in production (`IS_PROD` flag from `env.js`)
