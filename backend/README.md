# GymOS — Backend (Express + DynamoDB)

API REST que sirve al frontend React. Stack: Node 18.19.1, Express, AWS SDK v3 para DynamoDB,
JWT RS256, Helmet, Zod, Winston.

## Setup

```bash
cp .env.example .env
npm install
npm run keys:gen      # genera par RSA en backend/keys/
npm run db:create     # crea tablas en DynamoDB
npm run db:seed       # carga datos demo
npm run dev
```

### DynamoDB Local (opcional)

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
# y en .env:
DYNAMODB_ENDPOINT=http://localhost:8000
```

## Estructura

```
src/
├── app.js                # Configura Express + middlewares
├── server.js             # Bootstrap HTTP
├── config/               # env, logger, dynamo client
├── middleware/           # auth, rbac, errorHandler, rateLimiter, validate, requestId
├── routes/               # endpoints por dominio
├── controllers/          # handlers (orquesta validación + repos)
├── repositories/         # acceso a DynamoDB
├── validators/           # esquemas Zod
├── services/             # jwt, password
├── scripts/              # createTables, seed, generateKeys
└── utils/                # keys, pagination
```

## Endpoints (todos bajo `/api/v1`)

| Método | Ruta                          | Rol            |
|--------|-------------------------------|----------------|
| POST   | `/auth/login`                 | público        |
| POST   | `/auth/refresh`               | público        |
| POST   | `/auth/logout`                | autenticado    |
| GET    | `/auth/me`                    | autenticado    |
| GET    | `/dashboard/summary`          | todos          |
| GET/POST/PUT/DELETE | `/clientes[...]` | ADMIN, RECEP   |
| GET/POST | `/pagos[...]`               | ADMIN, RECEP   |
| GET/POST/PUT/DELETE | `/inventario[...]` | ADMIN     |
| GET/POST/PUT | `/nomina[...]`            | ADMIN          |
| GET/POST/PUT | `/rutinas/clientes[...]`  | ADMIN, COACH   |
| GET/POST/PUT | `/rutinas/coach[...]`     | ADMIN, COACH   |
| GET/POST/PUT | `/recordatorios[...]`     | ADMIN, RECEP   |

Todas las mutaciones requieren header `X-CSRF-Token` (double submit cookie pattern).

## Seguridad

Ver `../docs/SECURITY-CHECKLIST.md`.
