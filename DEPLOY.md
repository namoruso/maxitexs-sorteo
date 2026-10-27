# Alternativas a Railway

Elige **una** opción. Todas usan el mismo `Dockerfile` y PostgreSQL.

---

## Opción A — Render.com (la más parecida a Railway)

1. Crea cuenta en [render.com](https://render.com) (GitHub / Google / email).
2. Sube el código a GitHub (ver pasos de repo abajo).
3. En Render: **New** → **Blueprint** → selecciona el repo.
4. Detectará `render.yaml` (web + Postgres gratis).
5. Tras el primer deploy, abre el servicio web → **Environment**:
   - `PUBLIC_URL` = `https://TU-SERVICIO.onrender.com` (la URL que te da Render)
6. En el servicio, **Shell** o logs: las migraciones corren al arrancar si usas el compose prod; con el Dockerfile puro, añade un **Pre-Deploy Command** (si tu plan lo permite) o corre una vez:

   En el servicio → **Shell**:
   ```bash
   node apps/api/dist/db/migrate.js
   ```

   Si el Blueprint no tiene pre-deploy, la forma más fiable es cambiar el start command del servicio a:
   ```bash
   node apps/api/dist/db/migrate.js && node apps/api/dist/index.js
   ```

7. Links:
   - Tótem: `https://…/totem`
   - Registro: `https://…/registro`
   - Admin: `https://…/admin`

**Nota:** el plan free de Render duerme tras inactividad (~15 min). El primer request tarda ~30–60 s en despertar. Para el día del evento, sube a un plan de pago pequeño o usa la Opción B.

---

## Opción B — VPS + Docker (recomendada para el evento)

Cualquier VPS barato: **Hetzner**, **DigitalOcean**, **Contabo**, **Oracle Cloud free**, etc. (~$4–6/mes).

### En tu máquina

```bash
cd /home/nick/Downloads/Evento/maxitexs-sorteo
git init && git add . && git commit -m "Initial sorteo app"
# sube a GitHub o copia por scp
```

### En el servidor

```bash
# Ubuntu ejemplo
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER   # luego cierra sesión y vuelve a entrar

git clone https://github.com/TU_USUARIO/maxitexs-sorteo.git
cd maxitexs-sorteo

cp .env.example .env.prod
nano .env.prod
```

Contenido mínimo de `.env.prod`:

```bash
POSTGRES_PASSWORD=elige-una-clave-db
ADMIN_PASSWORD=elige-clave-admin
SESSION_SECRET=pega-openssl-rand-hex-32
PUBLIC_URL=https://sorteo.tudominio.com
# o http://IP_DEL_VPS:3000 mientras no tengas dominio
PORT=3000
```

Arranque:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

Abre: `http://IP:3000/api/health`

### HTTPS (opcional pero recomendado para el QR)

Con un dominio apuntando al VPS, usa Caddy o Nginx + Let’s Encrypt delante del puerto 3000. Ejemplo rápido con Caddy:

```bash
sudo apt install -y caddy
# Caddyfile:
# sorteo.tudominio.com {
#   reverse_proxy localhost:3000
# }
sudo systemctl reload caddy
```

Luego `PUBLIC_URL=https://sorteo.tudominio.com` y recrea el contenedor api.

---

## Opción C — Fly.io

```bash
# Instala flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch          # detecta Dockerfile
fly postgres create
fly postgres attach <nombre-db>
fly secrets set PUBLIC_URL=https://TU-APP.fly.dev ADMIN_PASSWORD=... SESSION_SECRET=... TZ=America/Caracas
fly deploy
fly ssh console -C "node apps/api/dist/db/migrate.js"
```

---

## Repo en GitHub (necesario para A y C)

```bash
cd /home/nick/Downloads/Evento/maxitexs-sorteo
gh auth login -h github.com   # si el token falló
git init
git add .
git commit -m "Initial Maxitexs sorteo"
gh repo create maxitexs-sorteo --private --source=. --remote=origin --push
```

---

## Comparación rápida

| Opción | Dificultad | Ideal para |
| --- | --- | --- |
| **Render** | Baja | Probar ya, sin servidor |
| **VPS + Docker** | Media | Día del evento (estable, sin “sleep”) |
| **Fly.io** | Media | Si ya usas Fly |

Para el evento en vivo, **Opción B (VPS)** es la más segura: no duerme y controlas el reinicio.
