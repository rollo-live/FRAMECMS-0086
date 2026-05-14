# Deploy Frame su VPS con Coolify

## 1. Prepara il VPS (IONOS)

- **OS**: Ubuntu 24.04 LTS
- **Specs**: 4 vCPU / 8 GB RAM / 80 GB NVMe
- **Datacenter**: Frankfurt (latenza minima dall'Italia)

SSH nel server appena creato:

```bash
ssh root@TUO-IP
```

## 2. Installa Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Apri `http://TUO-IP:8000` → crea account admin → done.

> Coolify installa Docker, Docker Compose e tutto il necessario automaticamente.

## 3. Collega il dominio

Nel DNS del tuo dominio aggiungi:

```
A    frame.tuodominio.it    →  TUO-IP-VPS
A    n8n.tuodominio.it      →  TUO-IP-VPS
A    *.tuodominio.it        →  TUO-IP-VPS   (wildcard per futuri progetti)
```

## 4. Deploy Frame su Coolify

### Opzione A — da GitHub (consigliata, deploy automatico ad ogni push)

1. **Sources** → Add → GitHub → Autorizza Coolify
2. **Projects** → New Project → `frame`
3. **New Resource** → **Application** → seleziona repo `frame`
4. Impostazioni:
   - **Build Pack**: `Dockerfile`
   - **Dockerfile path**: `./Dockerfile`
   - **Port**: `8080`
   - **Domain**: `frame.tuodominio.it`
   - **HTTPS**: On (Let's Encrypt automatico)
5. **Environment Variables** → aggiungi tutte le variabili da `.env.example`
6. **Deploy** → 🚀

### Opzione B — da Docker Compose

1. **New Resource** → **Docker Compose**
2. Incolla il contenuto di `docker-compose.coolify.yml`
3. Aggiungi env vars nell'UI
4. Deploy

## 5. Installa n8n (1 click)

1. **New Resource** → **Service** → cerca `n8n`
2. Domain: `n8n.tuodominio.it`
3. Imposta `N8N_BASIC_AUTH_USER` e `N8N_BASIC_AUTH_PASSWORD`
4. Deploy

## 6. Variabili d'ambiente obbligatorie

Copia da `.env.example` e imposta nell'UI Coolify → Environment Variables:

| Variabile | Dove trovarla |
|-----------|---------------|
| `DATABASE_URL` | Dashboard Turso |
| `DATABASE_AUTH_TOKEN` | Dashboard Turso |
| `BETTER_AUTH_SECRET` | Genera con `openssl rand -hex 32` |
| `WEBSITE_URL` | Il tuo dominio, es. `https://frame.tuodominio.it/` |
| `APP_URL` | Il tuo dominio, es. `https://frame.tuodominio.it` |
| `S3_*` | Dashboard Cloudflare R2 |
| `GMAIL_APP_PASSWORD` | Google Account → Sicurezza → Password app |

## 7. Verifica deploy

```bash
curl https://frame.tuodominio.it/api/health
# → {"status":"ok","app":"FRAME"}
```

## 8. Deploy automatico (CI/CD)

Coolify supporta webhook GitHub nativamente.
Ogni `git push main` → rebuild + redeploy automatico. Zero config.

Per abilitarlo: **Application** → **Configuration** → **Auto Deploy** → On

## Troubleshooting

```bash
# Logs real-time su Coolify UI → Logs tab
# Oppure via SSH:
docker logs frame-container-name -f

# Restart manuale
docker restart frame-container-name
```
