# BLACKBOX.md — IronCore Gym Management System

## Project Overview

**IronCore** is a full-stack gym management system (monorepo) with:
- **Backend**: Node.js 20+ / Express REST API with AWS DynamoDB
- **Frontend**: React 18.3 + Vite SPA with dual portals (staff and client)
- **Design**: Industrial dark theme with orange-gold accents

### Core Features

| Portal | Roles | Features |
|--------|-------|----------|
| Staff | ADMIN, COACH, RECEP | Dashboard KPIs, client management, payments, inventory, payroll, routines |
| Client | CLIENTE | Personal summary, membership, routines, workout log, measurements, progress tracking |

---

## Building and Running

### Prerequisites
- Node.js 20+
- Docker (for DynamoDB Local)
- AWS credentials (or use DynamoDB Local)

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: set DYNAMODB_ENDPOINT=http://localhost:8000 for local dev
npm install
npm run keys:gen    # Generate RS256 JWT key pair → backend/keys/
npm run db:create    # Create DynamoDB tables
npm run db:seed      # Load demo data
npm run dev          # Start on http://localhost:4000/api/v1
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # Start on http://localhost:5173
npm run build        # Production build
npm run preview     # Preview production build
```

### DynamoDB Local (Optional)

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
# Set DYNAMODB_ENDPOINT=http://localhost:8000 in backend/.env
```

### Demo Credentials (after seed)

| Email | Password | Role |
|-------|----------|------|
| admin@ironcore.mx | Admin#2026 | ADMIN |
| coach@ironcore.mx | Coach#2026 | COACH |
| recepcion@ironcore.mx | Recep#2026 | RECEP |
| carlos@email.com | Cliente#2026 | CLIENTE |

---

## Development Conventions

### Architecture Pattern

**Backend Flow:**
```
Route → Middleware (auth, RBAC, CSRF, validation) → Controller → Repository/Service
```

**Key Patterns:**
- DynamoDB queries use `ExpressionAttributeNames` + `ExpressionAttributeValues` (no string interpolation)
- All endpoints validated with Zod schemas via `validate()` middleware
- Errors follow structure: `{ error, code, details, requestId }`
- Use `HttpError(status, code, message)` for error handling

**Frontend Flow:**
- JWT stored in memory only (via `tokenStore.js`) — never localStorage
- Axios interceptors handle silent token refresh
- CSRF token via cookie (readable by JS)
- All forms use React Hook Form + Zod resolver

### Naming Conventions

| Pattern | Purpose |
|---------|---------|
| `clientes.routes.js` | Staff-facing client management API (`/api/v1/clientes`) |
| `cliente.routes.js` | Client self-service portal API (`/api/v1/cliente`) |

### Database Scripts

```bash
npm run db:create       # Create all tables (idempotent)
npm run db:seed        # Load demo data
npm run db:clear-seed  # Remove seeded data only
npm run db:reset       # Drop + recreate tables, then seed
```

### Adding New Features

**Backend:**
1. Create Zod validator in `validators/`
2. Create repository in `repositories/`
3. Create controller in `controllers/`
4. Create route in `routes/`
5. Register in `routes/index.js`

**Frontend:**
1. Create component in `pages/`
2. Add route in `App.jsx` (use appropriate layout + ProtectedRoute)
3. Add nav link in `Sidebar.jsx` or `ClienteSidebar.jsx`
4. Create service in `services/`

---

## Key Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DYNAMODB_ENDPOINT` | DynamoDB URL (use local for dev) |
| `AWS_REGION` | AWS region |
| `JWT_PRIVATE_KEY_PATH` | Path to RS256 private key |
| `JWT_PUBLIC_KEY_PATH` | Path to RS256 public key |
| `CORS_ORIGINS` | Allowed origins (comma-separated) |
| `COOKIE_SECURE` | Set `true` in production |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend base URL |

---

## Testing & Linting

**Currently NOT configured.** See `backend/package.json` and `frontend/package.json` for placeholder scripts.

To add:
- **Backend**: `vitest` + `backend/src/**/*.test.js`
- **Frontend**: `vitest` + React Testing Library
- **Linting**: `eslint` with `.eslintrc.json`

---

## Security Notes

- JWT in memory only (no localStorage)
- RS256 asymmetric tokens
- Access token: 15 min, Refresh token: 7 days (httpOnly, rotated)
- bcrypt saltRounds = 12
- Rate limiting: 200 req/15 min per IP; stricter on `/auth/login`
- Account lockout: 5 failed attempts → 15 min lock
- See `docs/SECURITY-CHECKLIST.md` for pre-release items

---

## Project Structure

```
gym-crm/
├── backend/           # Express API
│   ├── src/
│   │   ├── config/   # env.js, dynamo.js, logger.js
│   │   ├── middleware/ # auth.js, errorHandler.js, rateLimiter.js, validate.js
│   │   ├── routes/   # Express route modules
│   │   ├── controllers/ # Request handlers
│   │   ├── services/ # jwt.service.js, password.service.js
│   │   ├── repositories/ # DynamoDB queries
│   │   ├── validators/ # Zod schemas
│   │   └── scripts/  # createTables.js, seed.js, generateKeys.js
│   └── keys/         # RS256 key pair (generated)
├── frontend/          # React SPA
│   ├── src/
│   │   ├── context/  # AuthContext.jsx
│   │   ├── guards/   # ProtectedRoute.jsx
│   │   ├── pages/   # Staff and client views
│   │   ├── components/layout/ # Layout, Sidebar, ClienteLayout
│   │   ├── services/ # api.js, *.service.js
│   │   ├── utils/    # tokenStore.js, sanitize.js, safeRoute.js
│   │   └── constants/ # theme.js (ROLES, NAV_ITEMS)
│   └── public/
└── docs/             # SECURITY-CHECKLIST.md
```