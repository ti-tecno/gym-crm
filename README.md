# GymOS — Sistema de Gestión de Gimnasio

Monorepo con frontend en **React (Vite)** y backend en **Node.js (Express + AWS DynamoDB)**.
Diseño industrial oscuro con acento naranja-dorado, basado en `gym-system.jsx`.

## Estructura

```
gym/
├── backend/    # API REST con JWT, Helmet, rate-limit, Zod, DynamoDB
└── frontend/   # SPA React + Vite, JWT en memoria, rutas protegidas, DOMPurify
```

## Quickstart

### Backend

```bash
cd backend
cp .env.example .env        # editar credenciales AWS y secretos JWT
npm install
npm run db:create           # crea tablas DynamoDB
npm run db:seed             # carga datos de demo
npm run dev                 # arranca en http://localhost:4000
```

> Para desarrollo local puedes usar **DynamoDB Local** (docker):
> ```bash
> docker run -d -p 8000:8000 amazon/dynamodb-local
> ```
> y poner `DYNAMODB_ENDPOINT=http://localhost:8000` en `.env`.

### Frontend

```bash
cd frontend
cp .env.example .env        # editar VITE_API_URL si difiere
npm install
npm run dev                 # arranca en http://localhost:5173
```

### Credenciales de demo (creadas por el seed)

| Usuario             | Password      | Rol     | Portal             |
|---------------------|---------------|---------|--------------------|
| admin@gymos.mx      | `Admin#2026`  | ADMIN   | Staff (`/dashboard`)|
| coach@gymos.mx      | `Coach#2026`  | COACH   | Staff (`/dashboard`)|
| recepcion@gymos.mx  | `Recep#2026`  | RECEP   | Staff (`/dashboard`)|
| carlos@email.com    | `Cliente#2026`| CLIENTE | Cliente (`/mi/resumen`)|

> Los nuevos clientes también pueden **auto-registrarse** desde la pantalla de Login → pestaña "Crear cuenta".

## Módulos

### Portal Staff (`ADMIN` / `COACH` / `RECEP`)
- **Dashboard** — KPIs, gráfico asistencia semanal, últimos pagos, alertas
- **Clientes & Pagos** — Lista, Registro Autónomo, Pago en Línea, Recordatorios
- **Inventario** — Stock con barra visual, alertas mínimo/crítico (ADMIN)
- **Nómina** — Empleados, salario, horas, pago pendiente (ADMIN)
- **Rutinas Clientes** — Plan semanal por músculo, métricas de adherencia (COACH/ADMIN)
- **Rutinas Coach** — Programas grupales (COACH/ADMIN)

### Portal Cliente (`CLIENTE`)
- **Mi Resumen** — Vista principal con KPIs personales, rutina activa, membresía
- **Mi Membresía** — Plan, estado, fecha de vencimiento, días restantes
- **Mis Rutinas** — Rutina asignada por el coach + biblioteca de plantillas grupales auto-asignables
- **Diario de Entrenamientos** — Marca cada serie (reps/peso/RPE) sobre tu rutina del día. PRs se actualizan automáticamente.
- **Medidas** — Peso, % grasa, perímetros (pecho, brazo, cintura, cadera, muslo) con deltas vs medida anterior
- **Progreso** — Heatmap 90 días + sparkline de peso + récords personales + timeline desde el alta

## Modelo DynamoDB

| Tabla                   | PK            | Índices secundarios |
|-------------------------|---------------|---------------------|
| `gym_users`             | `userId`      | GSI: `email`        |
| `gym_clientes`          | `clienteId`   | GSI: `email`, `estado` |
| `gym_pagos`             | `pagoId`      | GSI: `clienteId`, `fecha` |
| `gym_inventario`        | `itemId`      | GSI: `categoria`    |
| `gym_nomina`            | `empleadoId`  | GSI: `estado`       |
| `gym_rutinas_clientes`  | `rutinaId`    | GSI: `clienteId`    |
| `gym_rutinas_coach`     | `rutinaId`    | —                   |
| `gym_recordatorios`     | `recordatorioId` | GSI: `clienteId`, `estado` |

## Seguridad implementada

**Backend:** Helmet (CSP + HSTS + nosniff + frameguard), CORS whitelist, rate-limit por IP y por endpoint sensible, JWT RS256 (access 15 min + refresh httpOnly rotado), bcrypt salt 12, Zod en cada endpoint, Winston con redacción de campos sensibles, error handler sin stack en producción, RBAC por rol, prevención de injection con `ExpressionAttribute*` parametrizados de DynamoDB.

**Frontend:** JWT en memoria (no localStorage), refresh silencioso por httpOnly cookie, DOMPurify para cualquier HTML, React Hook Form + Zod, ProtectedRoute con verificación de expiración y RBAC, validador de URLs/rutas confiables, sin secretos en bundle (sólo `VITE_*` públicos), axios con interceptores y retry con backoff.

Ver `docs/SECURITY-CHECKLIST.md` para la lista completa.
