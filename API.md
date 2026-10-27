# Contrato de API: Maxitex’s Sorteo (v2)

Backend TypeScript (`apps/api`) + SPA React (`apps/web`). Arranque: `npm run dev:api` / `npm run dev:web`.

## Público

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/api/evento` | `{ nombre, premio }` |
| POST | `/api/registro/verificar` | `{ cedula:{numero}, telefono? }` → `{ cedula:bool, telefono:bool }` |
| POST | `/api/registro` | Crea ticket. `409 { campo, mensaje }` si cédula/teléfono duplicados |
| GET | `/api/totem/estado` | Estado del tótem (enmascara datos) |
| GET | `/api/totem/stream` | SSE público |

Unicidad por **jornada**: cédula solo por número (V/E indistinto) + teléfono.

## Admin (cookie `mx_admin`)

| Método | Ruta |
| --- | --- |
| POST | `/api/admin/login` |
| POST | `/api/admin/logout` |
| GET | `/api/admin/me` |
| GET | `/api/admin/estado` |
| GET | `/api/admin/stream` | SSE con datos completos |
| POST | `/api/admin/sorteo` | Crypto-random; tótem → `sorteo` |
| POST | `/api/admin/sorteo/:id/entrega` |
| POST | `/api/admin/sorteo/:id/ausente` | Marca ausente y relanza |
| POST | `/api/admin/totem/captacion` | Vuelve al QR |
| POST | `/api/admin/reiniciar` | Cierra jornada y abre una nueva |
| GET | `/api/admin/exportar.csv` |

## Modelo

PostgreSQL: `jornadas`, `participantes`, `sorteos`, `totem_estado`, `admin_sesiones`.
Ver `apps/api/drizzle/0000_init.sql`.
