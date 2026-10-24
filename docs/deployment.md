# FleetGuard - Production Deployment & Continuous Operation

This document describes how to deploy the FleetGuard platform for 24/7 continuous operation in production environments.

---

## 1. Continuous Service Management with PM2

To ensure the Node.js backend automatically recovers from uncaught exceptions, system reboots, and memory pressure:

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
2. Build the production bundle:
   ```bash
   cd FleetGuard/backend
   npm run build
   ```
3. Start using PM2 with cluster mode:
   ```bash
   pm2 start dist/index.js --name "fleetguard-backend" -i max --time
   ```
4. Save process list to restart on server reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

---

## 2. Docker Compose Deployment (PostgreSQL + FleetGuard)

FleetGuard includes a ready-to-run `docker-compose.yml` for multi-container production environments:

```bash
docker-compose up -d --build
```

To migrate database schema in PostgreSQL:
```bash
docker-compose exec backend npx prisma migrate deploy
```

---

## 3. Reverse Proxy Configuration (Nginx)

When deploying behind Nginx with SSL, configure WebSocket forwarding headers:

```nginx
server {
    listen 80;
    server_name fleetguard.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fleetguard.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/fleetguard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleetguard.yourdomain.com/privkey.pem;

    # Frontend Static SPA
    location / {
        root /var/www/fleetguard/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # REST API Endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Telemetry Stream
    location /ws {
        proxy_pass http://127.0.0.1:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
