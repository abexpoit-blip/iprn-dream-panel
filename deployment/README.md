# Nexus-X Panel Deployment Guide

This folder contains everything needed to self-host the Nexus-X Panel and Bot on your own VPS.

## Prerequisites
- VPS with Ubuntu 22.04+ (Recommended)
- Docker and Docker Compose installed
- Domain names pointed to your VPS IP:
  - `panel.nexus-x.site` (Web UI)
  - `ap2.nexus-x.site` (API)

## Quick Start

1. **Clone/Copy files to VPS**:
   ```bash
   mkdir -p /opt/nexus
   # Copy the deployment folder contents to /opt/nexus
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your secrets
   nano .env
   ```

3. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```

4. **Initialize Database**:
   The `init.sql` script in `server/init.sql` is automatically executed on the first run by the Postgres container.

5. **Access**:
   - UI: `http://panel.nexus-x.site`
   - API: `http://ap2.nexus-x.site`

## SSL Configuration (HTTPS)
Use Certbot to obtain SSL certificates on your host:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d panel.nexus-x.site -d ap2.nexus-x.site
```
Then update `nginx/conf.d/default.conf` to use the certificates in `/etc/letsencrypt/live/...`.

## Bot Management
The scraper workers run as a separate container. Logs can be viewed via:
```bash
docker logs -f nexus_bot
```
To update bot settings, use the Admin Panel UI under "Bots & Ingest".
