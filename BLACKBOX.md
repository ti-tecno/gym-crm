# BLACKBOX.md — IronCore Gym Management System

## Project Overview

**IronCore** is a full-stack gym management system with dual portals:
- **Staff Portal** (ADMIN, COACH, RECEP roles): Dashboard, client management, payments, inventory, payroll, routines
- **Client Portal** (CLIENTE role): Personal summary, membership, routines, workout diary, measurements, progress tracking

### Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React 18.3, Vite 5, React Router DOM, React Hook Form, Zod, DOMPurify, Axios |
| Backend | Node.js 20+, Express, AWS DynamoDB, JWT RS256, Zod, Helmet, Winston |
| Database | DynamoDB (local or AWS) |
| Auth | RS256 asymmetric JWT (access 15 min + refresh httpOnly cookie) |

### Project Structure

```
gym-crm/
├── backend/           # Express API (port 4000)
│   ├── src/
│   │   ├── config/   # env.js, dynamo.js, logger.js
│   │   ├── middleware/  # auth.js, errorHandler.js, rateLimiter.js, validate.js
│   │   ├── routes/   # Express route modules
│   │   ├── controllers/  # Request handlers
│   │   ├── services/  # jwt.service.js, password.service.js
│   │   ├── repositories/  # DynamoDB queries
│   │   ├── validators/  # Zod schemas
│   │   └── scripts/  # createTables.js, seed.js, generateKeys.js
│   └── keys/         # RS256 JWT key pair
├── frontend/         # React SPA (port 5173)
│   ├── src/
│   │   ├── context/ # AuthContext.jsx
│   │   ├── guards/   # ProtectedRoute.jsx
│   │   ├── pages/    # Staff + Client views
│   │   ├── components/layout/  # Layout, Sidebar, ClienteLayout, ClienteSidebar
│   │   ├── services/  # api.js, *.service.js
│   │   ├── utils/    # tokenStore.js, sanitize.js, safeRoute.js
│   │   └── constants/  # theme.js (ROLES, colors, NAV_ITEMS)
│   └── dist/         # Production build
└── docs/            # SECURITY-CHECKLIST.md
```

---

## Building and Running

### Prerequisites

- Node.js 20+
- Docker (optional, for DynamoDB Local)
- AWS credentials OR local DynamoDB

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: set DYNAMODB_ENDPOINT=http://localhost:8000 for local dev
npm install
npm run keys:gen    # Generate RS256 key pair → backend/keys/
npm run db:create   # Create DynamoDB tables
npm run db:seed    # Load demo data
npm run dev        # Start on http://localhost:4000/api/v1
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev         # Start on http://localhost:5173
npm run build      # Production build
npm run preview   # Preview production build
```

### DynamoDB Local (Optional)

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
# Set DYNAMODB_ENDPOINT=http://localhost:8000 in backend/.env
```

### Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@ironcore.mx | Admin#2026 | ADMIN |
| coach@ironcore.mx | Coach#2026 | COACH |
| recepcion@ironcore.mx | Recep#2026 | RECEP |
| carlos@email.com | Cliente#2026 | CLIENTE |

---

## Development Conventions

### Backend Architecture

**Request Flow:**
```
Route → requireAuth → requireRole → requireCsrf → validate(schema) → Controller → Repository/Service
```

**Key Patterns:**
- All endpoints use Zod validation via `validate(schema)` middleware
- DynamoDB queries use `ExpressionAttributeNames` + `ExpressionAttributeValues` (no interpolation)
- Errors follow structure: `{ "error": "...", "code": "SNAKE_CASE_CODE", "details": {...}, "requestId": "uuid" }`
- Use `HttpError(status, code, message)` for error handling
- Winston logs with automatic redaction of sensitive fields (`password`, `token`, `cc`)

**Route Naming:**
- `clientes.routes.js` — Staff-facing client management (`/api/v1/clientes`)
- `cliente.routes.js` — Self-service portal for CLIENTE role (`/api/v1/cliente`)

### Frontend Architecture

**Dual-Layout Routing:**
- Staff roles (`ADMIN`, `COACH`, `RECEP`) → `<Layout>` + `<Sidebar>`
- `CLIENTE` role → `<ClienteLayout>` + `<ClienteSidebar>`

**Key Patterns:**
- JWT stored in memory only via `tokenStore.js` (never localStorage)
- Axios interceptor silently refreshes on 401 before retrying
- CSRF double-submit: cookie readable by JS, sent as `X-CSRF-Token` header on mutating requests
- All dynamic HTML passes through DOMPurify (`utils/sanitize.js`)
- Forms: React Hook Form + Zod resolver

### Adding New Features

**Backend:**
1. Create Zod validator in `validators/feature.schema.js`
2. Create repository in `repositories/feature.repo.js`
3. Create controller in `controllers/feature.controller.js`
4. Create route in `routes/feature.routes.js`
5. Register in `routes/index.js`

**Frontend:**
1. Create component in `pages/`
2. Add route in `App.jsx` (inside appropriate layout tree)
3. Add link in `Sidebar.jsx` or `ClienteSidebar.jsx` via `constants/theme.js`
4. Create service in `services/feature.service.js`

### Database Scripts

```bash
npm run db:create      # Create all tables (idempotent)
npm run db:seed        # Load demo data
npm run db:clear-seed # Remove seeded data only
npm run db:reset     # Drop + recreate tables, then seed
```

---

## Key Environment Variables

### Backend (.env)

| Variable | Purpose |
|----------|---------|
| `DYNAMODB_ENDPOINT` | Set to `http://localhost:8000` for local DDB |
| `AWS_REGION` | DynamoDB region |
| `JWT_PRIVATE_KEY_PATH` | Path to RS256 private key |
| `JWT_PUBLIC_KEY_PATH` | Path to RS256 public key |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `COOKIE_SECURE` | Set `true` in production |

### Frontend (.env)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend base URL (e.g., `http://localhost:4000/api/v1`) |

---

## Security Notes

- Rate limiting: 200 req/15 min per IP; stricter on `/auth/login` (5 attempts/15 min)
- Account lockout: 5 failed login attempts → 15 min lock
- bcrypt saltRounds = 12
- Never add `VITE_` prefixed secrets — they bundle into frontend
- Stack traces suppressed in production
- See `docs/SECURITY-CHECKLIST.md` for pre-release items

---

## Linting & Testing

No linting or test framework configured yet. Placeholder scripts exist in `package.json`:
- Backend: `npm run lint` → `echo 'Add eslint if needed'`
- Backend: `npm run test` → `echo 'Add tests with vitest or jest'`
- Frontend: No lint/test scripts defined