# Maxitex’s Sorteo

Sorteo en vivo para Corporación Maxitex’s.

**Stack:** React + Vite + TypeScript (web) · Express + Drizzle + PostgreSQL (API) · SSE tiempo real

## Estructura

```
packages/shared   # schemas Zod, normalización, tipos compartidos
apps/api          # API + SSE + migraciones
apps/web          # SPA React (registro / tótem / admin)
```

## Desarrollo local

```bash
# 1. Postgres
docker compose up -d   # Postgres en localhost:5438

# 2. Instalar y migrar
npm install
npm run build -w @maxitexs/shared
npm run db:migrate
npm run db:seed   # opcional

# 3. Arrancar API + Vite
npm run dev:api   # :3000
npm run dev:web   # :5173 (proxy /api → :3000)
```

| Pantalla | URL |
| --- | --- |
| Registro | http://localhost:5173/registro |
| Tótem | http://localhost:5173/totem |
| Admin | http://localhost:5173/admin (`admin` / ver `.env`) |

## Producción

Si no puedes usar Railway, ver alternativas en **[DEPLOY.md](./DEPLOY.md)** (Render, VPS+Docker, Fly.io).

```bash
npm run build
npm run db:migrate
npm start
```

## Reglas de negocio

- Cédula única **por número** (V/E no importa) dentro de la jornada.
- Teléfono único dentro de la jornada.
- El admin debe pulsar **Lanzar sorteo** para animar el tótem (no hay cambio automático desde el QR).
- El panel admin se actualiza en **tiempo real** (SSE) al completar un registro.
- **Nueva jornada** cierra la actual sin borrar histórico; a las 00:00 America/Caracas se abre una jornada nueva.
