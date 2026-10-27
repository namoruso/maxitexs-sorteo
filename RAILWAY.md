# Desplegar en Railway (v2 — React + Postgres)

## 1. Servicios

1. **New Project** → conectar este repo.
2. Añadir plugin **PostgreSQL**.
3. En el servicio de la app → **Variables**:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PUBLIC_URL` | `https://tu-dominio.up.railway.app` |
| `ADMIN_USER` | `admin` |
| `ADMIN_PASSWORD` | *(clave fuerte)* |
| `SESSION_SECRET` | *(32+ caracteres)* |
| `TZ` | `America/Caracas` |
| `PREMIO` | `Premio` |
| `NODE_ENV` | `production` |

4. **Networking** → Generate Domain → usa esa URL en `PUBLIC_URL`.
5. El `Dockerfile` construye shared + api + web. `railway.toml` corre migraciones en `preDeployCommand`.

**Ya no hace falta volumen** `/data`: los datos viven en Postgres.

## 2. Links

| Rol | Path |
| --- | --- |
| Health | `/api/health` |
| Tótem | `/totem` |
| Registro (QR) | `/registro` |
| Admin | `/admin` |

## 3. Checklist

1. `/api/health` → `ok: true` y `publicUrl` correcto.
2. Tótem muestra QR que abre `/registro` en el móvil.
3. Registro de prueba aparece al instante en admin.
4. **Lanzar sorteo** → animación → ganador.
5. **Volver al QR** restaura captación.
