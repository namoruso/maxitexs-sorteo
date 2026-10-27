# Despliegue gratis (evento de 1–2 días)

Ordenadas de **más recomendada → menos** para tu caso.

---

## Opción 1 — Laptop del evento + túnel Cloudflare (recomendada)

**Costo: $0.** No depende de que un PaaS “despierte”. Ideal para 2 días.

### Requisitos
- Una laptop/PC en el evento (o en casa con buen internet) con Docker o Node.
- Los móviles de los asistentes con internet (datos o Wi‑Fi).

### A) Arrancar la app en local

```bash
cd /home/nick/Downloads/Evento/maxitexs-sorteo

# Postgres
docker compose up -d

# Migrar (solo la primera vez)
npm install
npm run build -w @maxitexs/shared
npm run db:migrate

# API sirviendo el frontend compilado
npm run build
PUBLIC_URL=http://localhost:3000 npm start
```

Comprueba: http://localhost:3000/api/health

### B) Túnel público gratis (Cloudflare)

1. Crea cuenta gratis en [dash.cloudflare.com](https://dash.cloudflare.com) (solo email).
2. Instala `cloudflared`:

```bash
# Fedora
sudo dnf install -y cloudflared
# o descarga: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

3. Login y túnel rápido (sin dominio propio):

```bash
cloudflared tunnel login
cloudflared tunnel --url http://localhost:3000
```

Te imprime una URL tipo:

```text
https://random-words-xxxx.trycloudflare.com
```

4. **Importante:** reinicia la app con esa URL como `PUBLIC_URL` (para que el QR apunte bien):

```bash
# Ctrl+C al servidor y:
PUBLIC_URL=https://random-words-xxxx.trycloudflare.com npm start
```

5. Abre en el tótem: `https://….trycloudflare.com/totem`  
   Registro (QR): `https://….trycloudflare.com/registro`  
   Admin: `https://….trycloudflare.com/admin`

### Tips del día del evento
- No cierres la laptop ni suspendas la sesión.
- Conecta la laptop a corriente.
- Si `cloudflared` se cae, vuelve a lanzar el comando: **la URL puede cambiar** → actualiza `PUBLIC_URL` y reinicia la app, o usa un túnel con nombre fijo (cuenta Cloudflare + tunnel named).
- Alternativa al trycloudflare: [ngrok](https://ngrok.com) free (`ngrok http 3000`) — también da HTTPS gratis.

---

## Opción 2 — Render free + “keep-alive”

**Costo: $0.** La app se duerme a los ~15 min sin tráfico.

1. Sube el repo a GitHub.
2. [render.com](https://render.com) → New → Blueprint → este repo (`render.yaml`).
3. Pon `PUBLIC_URL=https://TU-APP.onrender.com` (opcional: si falta, se usa `RENDER_EXTERNAL_URL`; el QR también usa la URL del mismo origen).
4. Evita el sleep con un ping gratis cada 10 min:
   - [cron-job.org](https://cron.job.org) (gratis) → URL: `https://TU-APP.onrender.com/api/health` cada 10 minutos.

**Riesgo:** el plan free de Postgres en Render puede borrarse tras ~30 días de inactividad; para 2 días alcanza. El cold start a veces falla si el ping no es constante.

---

## Opción 3 — Oracle Cloud “Always Free”

**Costo: $0** (VM ARM permanente). Más trabajo de setup.

1. Cuenta en [cloud.oracle.com](https://cloud.oracle.com) → Always Free ARM (Ampere).
2. Abre puertos 22 y 3000 (o 80/443).
3. Instala Docker y usa `docker-compose.prod.yml` (ver `DEPLOY.md` opción B).

Buena si quieres dejarlo online varios días sin laptop encendida.

---

## Opción 4 — Fly.io free allowance

Tiene crédito/recursos free limitados. Útil si ya tienes cuenta. Ver `DEPLOY.md`.

---

## Qué NO usar gratis para el evento en vivo

| Plataforma | Por qué |
| --- | --- |
| Railway free trial | No puedes entrar / límites |
| Vercel / Netlify solos | No sirven bien para API + Postgres + SSE todo-en-uno |
| Render free **sin** keep-alive | Se duerme en medio del registro |

---

## Checklist mínimo (Opción 1)

- [ ] `docker compose up -d` + `npm start` OK en local  
- [ ] `cloudflared tunnel --url http://localhost:3000` da HTTPS  
- [ ] `PUBLIC_URL` = esa URL HTTPS  
- [ ] Móvil escanea QR → abre `/registro`  
- [ ] Admin ve el registro al instante  
- [ ] Laptop enchufada y sin suspender  

Para 2 días, **Opción 1** es la más simple y la que menos falla.
