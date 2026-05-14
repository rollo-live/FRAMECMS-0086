# Deploy Frame su VPS

## Prerequisiti sulla VPS
- Ubuntu 22.04+
- Nginx installato
- Bun installato (`curl -fsSL https://bun.sh/install | bash`)
- Certbot per SSL (`apt install certbot python3-certbot-nginx`)

---

## Opzione A — Deploy manuale (zip)

### 1. Carica lo zip sulla VPS
```bash
scp frame-deploy.zip ubuntu@TUA_VPS_IP:/tmp/
```

### 2. Estrai e posiziona
```bash
ssh ubuntu@TUA_VPS_IP
sudo mkdir -p /opt/frame
sudo unzip /tmp/frame-deploy.zip -d /opt/frame
sudo chown -R ubuntu:ubuntu /opt/frame
```

### 3. Copia il file env
```bash
cp /opt/frame/.env.production /opt/frame/.env.production
# (già incluso nello zip — verifica che APP_URL sia corretto)
```

### 4. Installa dipendenze
```bash
cd /opt/frame
bun install --production
```

### 5. Configura il servizio systemd
```bash
sudo cp /opt/frame/deploy/frame.service /etc/systemd/system/frame.service
sudo systemctl daemon-reload
sudo systemctl enable frame
sudo systemctl start frame
# Verifica
sudo systemctl status frame
```

### 6. Configura Nginx
```bash
sudo cp /opt/frame/nginx.conf /etc/nginx/sites-available/frame
sudo ln -s /etc/nginx/sites-available/frame /etc/nginx/sites-enabled/frame
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL con Let's Encrypt
```bash
sudo certbot --nginx -d app.framestudios.it
```

---

## Opzione B — Docker

### 1. Build immagine
```bash
cd /opt/frame
docker build -t frame-app .
```

### 2. Avvia container
```bash
docker run -d \
  --name frame \
  --restart unless-stopped \
  --env-file .env.production \
  -p 8080:8080 \
  frame-app
```

### 3. Nginx + SSL
Uguale ai passi 6 e 7 dell'opzione A.

---

## Aggiornamenti futuri

### Manuale
```bash
# Carica il nuovo zip, estrai in /opt/frame, poi:
sudo systemctl restart frame
```

### Docker
```bash
docker build -t frame-app .
docker stop frame && docker rm frame
docker run -d --name frame --restart unless-stopped --env-file .env.production -p 8080:8080 frame-app
```

---

## Verifica funzionamento
```bash
curl http://localhost:8080/api/health
# Deve rispondere 200
```

## Note importanti
- Il DB è su **Turso** (cloud) — nessuna configurazione locale necessaria
- I file media sono su **Cloudflare R2** — nessun disco locale richiesto
- Ricorda di aggiornare i **redirect URI** Google OAuth in Google Cloud Console:
  `https://app.framestudios.it/api/bookings/oauth/callback`
