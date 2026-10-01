# Panduan Deployment — RenRND Sales Agentic AI

Dokumen ini menjelaskan cara men-deploy aplikasi **RenRND Sales Agentic AI** ke lingkungan production menggunakan Docker Compose. Mencakup prasyarat sistem, arsitektur, langkah-langkah deployment, konfigurasi Nginx & SSL, CI/CD, variabel environment, monitoring, checklist production, dan troubleshooting.

---

## Daftar Isi

1. [Prasyarat Sistem](#1-prasyarat-sistem)
2. [Arsitektur Production](#2-arsitektur-production)
3. [Step-by-Step Deployment](#3-step-by-step-deployment)
4. [Menggunakan start.sh dan stop.sh](#4-menggunakan-startsh-dan-stopsh)
5. [Nginx Configuration](#5-nginx-configuration)
6. [SSL/TLS Setup](#6-ssltls-setup)
7. [CI/CD Pipeline (GitHub Actions)](#7-cicd-pipeline-github-actions)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Monitoring & Maintenance](#9-monitoring--maintenance)
10. [Production Checklist](#10-production-checklist)
11. [Troubleshooting Deployment](#11-troubleshooting-deployment)

---

## 1. Prasyarat Sistem

Sebelum memulai deployment, pastikan sistem memenuhi persyaratan berikut:

| Komponen | Persyaratan | Catatan |
|----------|-------------|---------|
| Docker | v24+ | Docker Engine atau Docker Desktop |
| Docker Compose | v2+ | Terintegrasi di Docker Desktop modern |
| RAM | Minimal 4GB (8GB recommended) | Backend + Celery + PostgreSQL + Redis + Frontend |
| Disk | Minimal 20GB | Untuk images, volumes, dan logs |
| OS | Linux / macOS / Windows (WSL2) | Linux recommended untuk production |
| Akun BytePlus ModelArk | API Key valid | Diperlukan untuk LLM & Embedding |

### Port yang harus tersedia

| Port | Service | Keterangan |
|------|---------|------------|
| 80 | nginx | HTTP (redirect ke HTTPS) |
| 443 | nginx | HTTPS |
| 3000 | frontend | Next.js (direct access untuk debugging) |
| 5432 | postgres | PostgreSQL 16 + pgvector |
| 6379 | redis | Redis 7 |
| 8000 | backend | FastAPI (direct access untuk debugging) |

> **Catatan:** Jika ada port yang sudah digunakan, sesuaikan mapping di `docker-compose.prod.yml` atau hentikan service yang konflik.

---

## 2. Arsitektur Production

Deployment production terdiri dari **7 services** yang berjalan dalam Docker Compose:

| Service | Container Name | Port | Image | Keterangan |
|---------|----------------|------|-------|------------|
| postgres | rsa_prod_postgres | 5432 | pgvector/pgvector:pg16 | Database dengan ekstensi pgvector untuk embeddings |
| redis | rsa_prod_redis | 6379 | redis:7-alpine | Message broker untuk Celery + cache |
| backend | rsa_prod_backend | 8000 | custom (python:3.11-slim) | FastAPI + Gunicorn (4 workers, Uvicorn) |
| celery_worker | rsa_prod_celery_worker | - | custom | Background task processor (concurrency=2) |
| celery_beat | rsa_prod_celery_beat | - | custom | Scheduler untuk periodic tasks (hourly/daily) |
| frontend | rsa_prod_frontend | 3000 | custom (node:20-slim) | Next.js 14 standalone build |
| nginx | rsa_prod_nginx | 80, 443 | nginx:alpine | Reverse proxy + SSL termination |

### Diagram Alur Request

```
Client (Browser)
    │
    ▼
┌─────────┐     80/443     ┌──────────────────────────────────────────┐
│  Nginx  │ ◄───────────── │  Reverse Proxy + SSL + Security Headers  │
└────┬────┘                └──────────────────────────────────────────┘
     │
     ├── /api/* ──────► Backend (FastAPI :8000)
     ├── /docs ───────► Backend (Swagger UI :8000)
     ├── /health ─────► Backend (Health Check :8000)
     └── /* ──────────► Frontend (Next.js :3000)
                           │
                           ▼
                    ┌──────────────┐
                    │   Backend    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │PostgreSQL│ │  Redis   │ │  BytePlus    │
        │ +pgvector│ │ (broker) │ │  ModelArk    │
        └──────────┘ └────┬─────┘ │  (LLM API)   │
                          │       └──────────────┘
                    ┌─────┴─────┐
                    │  Celery   │
                    │ worker +  │
                    │   beat    │
                    └───────────┘
```

---

## 3. Step-by-Step Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/renrnd-sales-agentic.git
cd renrnd-sales-agentic
```

### Step 2: Konfigurasi .env.production

Buat file `.env.production` dari template dan isi nilai production:

```bash
cp .env.production .env.production  # jika belum ada, edit langsung
# atau buat dari .env.example
cp .env.example .env.production
```

Edit `.env.production` dan isi nilai berikut:

```ini
# BytePlus ModelArk — WAJIB
ARK_API_KEY=your_actual_byteplus_api_key_here

# Database — WAJIB (gunakan password yang kuat!)
POSTGRES_USER=rsa_admin
POSTGRES_PASSWORD=ganti_dengan_password_yang_sangat_kuat_2026
POSTGRES_DB=rsa_sales

# JWT — WAJIB (minimal 32 karakter)
JWT_SECRET=generate_secret_key_min_32_characters_random_string

# App
DEBUG=false

# Frontend (URL domain production Anda)
NEXT_PUBLIC_API_URL=https://your-domain.com

# Tableau (opsional, untuk analytics embed)
TABLEAU_SERVER=https://your-tableau-server.com
TABLEAU_TOKEN_NAME=your_token_name
TABLEAU_TOKEN_SECRET=your_token_secret
TABLEAU_SITE_ID=your_site_id
```

> **Penting:** Jangan commit file `.env.production` ke repository. Pastikan file ini ada di `.gitignore`.

### Step 3: Setup SSL Certificate

#### Self-signed (untuk testing)

```bash
# Buat direktori certs jika belum ada
mkdir -p nginx/certs

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

> **Catatan:** Nginx config (`nginx/nginx.conf`) me-referensi `fullchain.pem` dan `privkey.pem` di path `/etc/nginx/certs/`. Pastikan nama file sesuai.

#### Let's Encrypt (untuk production)

```bash
# Install certbot jika belum ada
sudo apt install certbot  # Ubuntu/Debian

# Generate certificate (hentikan nginx dulu jika sedang berjalan)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificate ke direktori nginx/certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/certs/privkey.pem

# Set permission
sudo chmod 644 nginx/certs/fullchain.pem
sudo chmod 600 nginx/certs/privkey.pem
```

### Step 4: Validasi Konfigurasi

Sebelum menjalankan, validasi `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Jika tidak ada output (exit code 0), konfigurasi valid. Jika ada error, perbaiki sebelum lanjut.

### Step 5: Build & Start Services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Proses ini akan:
- Build image custom untuk backend dan frontend
- Pull image untuk postgres, redis, dan nginx
- Start semua 7 services dalam detached mode
- Inisialisasi database pertama kali (init.sql dijalankan otomatis oleh PostgreSQL)

Tunggu hingga semua service healthy (terutama postgres dan redis yang memiliki healthcheck):

```bash
docker compose -f docker-compose.prod.yml ps
```

### Step 6: Seed Database (First Run)

Jalankan seed script untuk mengisi database dengan data awal (dummy data untuk testing):

```bash
docker exec -it rsa_prod_backend python3 -m app.db.seed
```

Atau gunakan `start.sh` dengan flag `--seed`:

```bash
./start.sh --prod --seed
```

Data yang di-seed:
- 4 users
- 8 accounts
- 8 contacts
- 20 opportunities
- 45 activities
- 10 tasks

### Step 7: Verifikasi Deployment

#### Health Check Backend

```bash
curl -s http://localhost:8000/health | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "app": "RenRND Sales Agentic AI",
  "version": "1.0.0"
}
```

#### API Test

```bash
# Test dashboard summary
curl -s http://localhost:8000/api/v1/dashboard/summary | jq .

# Test opportunities list
curl -s http://localhost:8000/api/v1/opportunities | jq .

# Test stages
curl -s http://localhost:8000/api/v1/stages | jq .
```

#### Frontend Test

```bash
# Direct access (port 3000)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# Via Nginx (port 80/443)
curl -s -o /dev/null -w "%{http_code}" http://localhost
# Expected: 301 (redirect ke HTTPS)
curl -sk -o /dev/null -w "%{http_code}" https://localhost
# Expected: 200
```

#### Swagger Documentation

Akses via browser: `https://localhost/docs` atau `http://localhost:8000/docs`

---

## 4. Menggunakan start.sh dan stop.sh

Project menyertakan script helper untuk memudahkan start/stop services.

### start.sh

```bash
# Start production (default)
./start.sh --prod

# Start production + seed database (recommended untuk first run)
./start.sh --prod --seed

# Start development mode (dengan hot reload)
./start.sh --dev

# Force rebuild Docker images
./start.sh --prod --build

# Tampilkan help
./start.sh --help
```

Script `start.sh` melakukan 6 langkah otomatis:
1. Cek Docker daemon berjalan
2. Cek dan validasi environment variables (`.env` untuk dev, `.env.production` untuk prod)
3. Validasi docker-compose file (`config --quiet`)
4. Build & start services (`up -d --build` jika `--build` flag aktif)
5. Tunggu services healthy (timeout 60 detik)
6. Seed database (jika `--seed` flag aktif)

### stop.sh

```bash
# Stop production (default)
./stop.sh --prod

# Stop development
./stop.sh --dev

# Stop semua (dev + prod sekaligus)
./stop.sh --all

# Stop + hapus semua data (DANGER!)
./stop.sh --clean
```

> **Peringatan:** `./stop.sh --clean` akan **menghapus semua data** termasuk database, Redis cache, dan volumes. Script akan meminta konfirmasi dengan mengetik `DELETE`. Data tidak bisa dikembalikan!

---

## 5. Nginx Configuration

File konfigurasi Nginx berada di `nginx/nginx.conf`. Berikut penjelasan fitur yang dikonfigurasi:

### Reverse Proxy Routes

| Route | Target | Keterangan |
|-------|--------|------------|
| `/api/*` | `backend:8000` | API endpoints (FastAPI) |
| `/docs` | `backend:8000` | Swagger UI documentation |
| `/health` | `backend:8000` | Health check endpoint |
| `/*` | `frontend:3000` | Next.js frontend (fallback) |

### SSL Termination

Nginx menangani SSL/TLS dan me-redirect semua HTTP (port 80) ke HTTPS (port 443):

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

SSL config:
- Protocols: TLSv1.2, TLSv1.3
- Ciphers: HIGH (menolak weak ciphers)
- `ssl_prefer_server_ciphers on`

### Security Headers

```nginx
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header X-Permitted-Cross-Domain-Policies "none";
```

### Gzip Compression

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 256;
```

### Customisasi

Untuk mengubah konfigurasi Nginx, edit `nginx/nginx.conf` lalu restart container:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 6. SSL/TLS Setup

### Self-Signed Certificate (Testing)

Generate self-signed certificate untuk development/testing:

```bash
mkdir -p nginx/certs

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

Certificate valid selama 365 hari. Browser akan menampilkan warning karena self-signed — klik "Advanced" > "Proceed" untuk lanjut.

### Let's Encrypt (Production)

#### Install Certbot

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install certbot

# macOS
brew install certbot
```

#### Generate Certificate

```bash
# Hentikan nginx jika sedang berjalan (port 80 harus bebas)
sudo certbot certonly --standalone -d your-domain.com
```

#### Copy Certificate ke Nginx

```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/certs/privkey.pem

# Set permission
sudo chmod 644 nginx/certs/fullchain.pem
sudo chmod 600 nginx/certs/privkey.pem
```

#### Auto-Renewal (Let's Encrypt)

Let's Encrypt certificate berlaku 90 hari. Setup auto-renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup cron job (cek setiap hari jam 3 pagi)
echo "0 3 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/nginx/certs/fullchain.pem && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/nginx/certs/privkey.pem && docker exec rsa_prod_nginx nginx -s reload'" | sudo tee -a /etc/crontab
```

> **Catatan:** Nginx config me-referensi `fullchain.pem` dan `privkey.pem` di path `/etc/nginx/certs/` (dari volume mount `./nginx/certs:/etc/nginx/certs`).

---

## 7. CI/CD Pipeline (GitHub Actions)

File: `.github/workflows/ci.yml`

Pipeline berjalan otomatis pada **push ke branch `main` atau `develop`** dan **pull request ke `main`**.

### Job 1: backend-test

Menjalankan backend testing dan validasi:

```yaml
runs-on: ubuntu-latest
services:
  - PostgreSQL 16 (pgvector) di port 5432
  - Redis 7 di port 6379
steps:
  1. Checkout code
  2. Setup Python 3.11
  3. Install dependencies (pip install -r backend/requirements.txt)
  4. Import check:
     - from app.config import settings
     - from app.models import Account, Opportunity, Stage, User, Contact, Activity, Task, AgentLog
     - from app.main import app (count routes)
```

### Job 2: frontend-build

Menjalankan build frontend untuk memastikan tidak ada error:

```yaml
runs-on: ubuntu-latest
steps:
  1. Checkout code
  2. Setup Node.js 20 (dengan npm cache)
  3. npm install
  4. npm run build (Next.js production build)
```

### Job 3: docker-build

Menjalankan Docker build untuk memvalidasi Dockerfile:

```yaml
runs-on: ubuntu-latest
needs: [backend-test, frontend-build]  # hanya jalan jika job 1 & 2 lulus
if: github.ref == 'refs/heads/main'    # hanya di branch main
steps:
  1. Checkout code
  2. Setup Docker Buildx
  3. Build backend image (docker/build-push-action, push: false)
  4. Build frontend image (docker/build-push-action, push: false)
```

### Diagram CI/CD

```
Push to main/develop / PR to main
         │
         ├──► backend-test ──┐
         │                   │
         ├──► frontend-build ┤
         │                   │
         │                   ▼
         │            docker-build (main only)
         │                   │
         │                   ▼
         │              Images built
         │              (not pushed)
         │
         └──► (semua lulus = green check)
```

---

## 8. Environment Variables Reference

Berikut adalah daftar lengkap environment variables yang digunakan aplikasi:

| Variable | Required | Default | Deskripsi |
|----------|----------|---------|-----------|
| `ARK_API_KEY` | Yes | (none) | API Key untuk BytePlus ModelArk. Wajib diisi untuk fungsi AI agents. |
| `ARK_BASE_URL` | No | `https://ark.ap-southeast.bytepluses.com/api/v3` | Base URL BytePlus ModelArk API |
| `LLM_MODEL_PRO` | No | `skylark-pro` | Model LLM untuk task kompleks (BANT scoring, pipeline evaluation) |
| `LLM_MODEL_LITE` | No | `skylark-lite` | Model LLM untuk task ringan (NER extraction) |
| `EMBEDDING_MODEL` | No | `skylark-embedding-vision` | Model embedding untuk pgvector (1024-dim) |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://rsa_admin:<your_password>@localhost:5432/rsa_sales` | Connection string PostgreSQL (di-override oleh POSTGRES_* di compose) |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Connection string Redis untuk Celery broker |
| `JWT_SECRET` | Yes | `<your_jwt_secret>` | Secret key untuk JWT signing. Minimal 32 karakter di production. |
| `JWT_ALGORITHM` | No | `HS256` | Algoritma JWT signing |
| `JWT_EXPIRE_MINUTES` | No | `1440` (24 jam) | Expiry JWT token dalam menit |
| `DEBUG` | No | `true` | Mode debug. Set `false` di production. |
| `POSTGRES_USER` | No | `rsa_admin` | Username PostgreSQL |
| `POSTGRES_PASSWORD` | Yes (prod) | (none) | Password PostgreSQL. Wajib diisi di `.env.production`. |
| `POSTGRES_DB` | No | `rsa_sales` | Nama database PostgreSQL |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | URL backend API yang digunakan frontend. Set ke domain production. |
| `TABLEAU_SERVER` | No | (none) | URL Tableau Server untuk analytics embed |
| `TABLEAU_TOKEN_NAME` | No | (none) | Token name untuk Tableau authentication |
| `TABLEAU_TOKEN_SECRET` | No | (none) | Token secret untuk Tableau authentication |
| `TABLEAU_SITE_ID` | No | (none) | Site ID Tableau |

### File Environment

| File | Lingkungan | Keterangan |
|------|-----------|------------|
| `.env` | Development | Digunakan oleh `docker-compose.yml` (dev mode) |
| `.env.production` | Production | Digunakan oleh `docker-compose.prod.yml` (prod mode) |
| `.env.example` | Template | Template untuk membuat `.env` atau `.env.production` |

---

## 9. Monitoring & Maintenance

### Melihat Logs

```bash
# Semua services
docker compose -f docker-compose.prod.yml logs -f

# Service tertentu
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f celery_worker
docker compose -f docker-compose.prod.yml logs -f nginx

# 100 baris terakhir
docker compose -f docker-compose.prod.yml logs --tail 100 backend
```

### Restart Service

```bash
# Restart backend saja
docker compose -f docker-compose.prod.yml restart backend

# Restart celery worker
docker compose -f docker-compose.prod.yml restart celery_worker

# Restart semua services
docker compose -f docker-compose.prod.yml restart
```

### Scale Backend

```bash
# Jalankan 2 instance backend (load balancing via Nginx upstream)
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

> **Catatan:** Nginx upstream `backend_upstream` me-reference `backend:8000`. Scaling akan otomatis didistribusikan oleh Docker DNS.

### Database Backup

```bash
# Backup database ke file
docker exec rsa_prod_postgres pg_dump -U rsa_admin rsa_sales > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup dengan compression
docker exec rsa_prod_postgres pg_dump -U rsa_admin rsa_sales | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Database Restore

```bash
# Restore dari file SQL
docker exec -i rsa_prod_postgres psql -U rsa_admin rsa_sales < backup_20260928.sql

# Restore dari file compressed
gunzip < backup_20260928.sql.gz | docker exec -i rsa_prod_postgres psql -U rsa_admin rsa_sales
```

### Database Migration / Refresh Materialized Views

```bash
# Refresh materialized views (jika ada)
docker exec rsa_prod_postgres psql -U rsa_admin rsa_sales -c "REFRESH MATERIALIZED VIEW mv_dashboard_summary;"
docker exec rsa_prod_postgres psql -U rsa_admin rsa_sales -c "REFRESH MATERIALIZED VIEW mv_rep_performance;"
```

### Re-seed Database

```bash
# Hentikan services
./stop.sh --prod

# Hapus volumes (data akan hilang!)
docker compose -f docker-compose.prod.yml down -v

# Start ulang + seed
./start.sh --prod --seed
```

### Monitoring Eksternal (Rekomendasi)

| Tool | Fungsi | Status |
|------|--------|--------|
| Grafana | Dashboard visual untuk metrics | Direkomendasikan |
| Prometheus | Metrics collection & alerting | Direkomendasikan |
| Loki | Log aggregation | Direkomendasikan |
| Promtail | Log shipper untuk Loki | Direkomendasikan |

---

## 10. Production Checklist

Sebelum go-live, pastikan semua item berikut sudah dicek:

### Konfigurasi
- [ ] `ARK_API_KEY` diisi dengan API key BytePlus ModelArk yang valid
- [ ] `POSTGRES_PASSWORD` diisi dengan password yang kuat (bukan default)
- [ ] `JWT_SECRET` diisi dengan string random minimal 32 karakter
- [ ] `DEBUG=false` di `.env.production`
- [ ] `.env.production` tidak di-commit ke repository (ada di `.gitignore`)

### SSL & Network
- [ ] SSL certificate sudah dikonfigurasi di `nginx/certs/`
- [ ] `docker-compose.prod.yml` valid (`config --quiet` pass)
- [ ] Nginx reverse proxy berfungsi (HTTP redirect ke HTTPS)

### Database
- [ ] Database sudah di-seed (`python3 -m app.db.seed` sukses)
- [ ] Semua endpoint API dapat diakses dan return data
- [ ] pgvector extension aktif

### Frontend
- [ ] Frontend dapat diakses via Nginx (HTTPS)
- [ ] `NEXT_PUBLIC_API_URL` menunjuk ke domain production yang benar
- [ ] Semua halaman render tanpa error

### Integrasi
- [ ] Tableau Server SSL dikonfigurasi (jika menggunakan analytics embed)
- [ ] BytePlus ModelArk API dapat diakses dari backend container

### Monitoring & Backup
- [ ] Monitoring setup: Grafana + Prometheus
- [ ] Log aggregation setup: Loki + Promtail
- [ ] Database backup schedule dikonfigurasi (cron job)
- [ ] Alerting rules dikonfigurasi di Prometheus

---

## 11. Troubleshooting Deployment

### Port Conflict

**Gejala:** Container gagal start dengan error `bind: address already in use`

**Solusi:**
```bash
# Cari process yang menggunakan port
lsof -i :80
lsof -i :443
lsof -i :5432

# Hentikan process yang konflik
sudo kill -9 <PID>

# Atau ubah port mapping di docker-compose.prod.yml
```

### Docker Daemon Not Running

**Gejala:** `Cannot connect to the Docker daemon`

**Solusi:**
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
sudo systemctl enable docker

# Verifikasi
docker info
```

### Health Check Failing

**Gejala:** Container status `unhealthy` atau `starting` terus-menerus

**Solusi:**
```bash
# Cek logs container
docker logs rsa_prod_backend
docker logs rsa_prod_postgres
docker logs rsa_prod_redis

# Cek detail health
docker inspect --format='{{json .State.Health}}' rsa_prod_postgres | jq .

# Pastikan dependencies healthy sebelum backend start
docker compose -f docker-compose.prod.yml ps
```

### Database Connection Error

**Gejala:** Backend error `could not connect to server` atau `password authentication failed`

**Solusi:**
```bash
# 1. Pastikan POSTGRES_PASSWORD sama di .env.production dan docker-compose.prod.yml
cat .env.production | grep POSTGRES_PASSWORD

# 2. Cek koneksi dari backend container
docker exec rsa_prod_backend python3 -c "
import asyncio
from app.db.database import engine
async def test():
    async with engine.connect() as conn:
        print('DB connected!')
asyncio.run(test())
"

# 3. Jika password berubah, hapus volume postgres dan start ulang
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

### Frontend Can't Reach Backend

**Gejala:** Frontend menampilkan error API atau blank page

**Solusi:**
```bash
# 1. Cek NEXT_PUBLIC_API_URL di .env.production
cat .env.production | grep NEXT_PUBLIC_API_URL

# 2. Pastikan URL benar (https untuk production)
# NEXT_PUBLIC_API_URL=https://your-domain.com

# 3. Rebuild frontend setelah mengubah env
docker compose -f docker-compose.prod.yml up -d --build frontend

# 4. Test API dari frontend container
docker exec rsa_prod_frontend curl -s http://backend:8000/health
```

### LLM / AI Agent Errors

**Gejala:** Error `ARK_API_KEY not set` atau `401 Unauthorized` saat menjalankan AI agents

**Solusi:**
```bash
# 1. Verifikasi ARK_API_KEY di .env.production
cat .env.production | grep ARK_API_KEY

# 2. Cek apakah key ter-load di container
docker exec rsa_prod_backend printenv ARK_API_KEY

# 3. Test API key langsung
docker exec rsa_prod_backend python3 -c "
from app.llm_client import llm_client
import asyncio
async def test():
    resp = await llm_client.chat('Hello', model='skylark-lite')
    print(resp)
asyncio.run(test())
"

# 4. Jika key invalid, update .env.production lalu restart backend
docker compose -f docker-compose.prod.yml restart backend celery_worker celery_beat
```

### Celery Worker Not Processing Tasks

**Gejala:** Background tasks tidak berjalan (pipeline scan, daily briefing)

**Solusi:**
```bash
# Cek status celery worker
docker logs rsa_prod_celery_worker --tail 50

# Pastikan redis healthy
docker exec rsa_prod_redis redis-cli ping

# Restart celery worker & beat
docker compose -f docker-compose.prod.yml restart celery_worker celery_beat

# Trigger manual task untuk testing
docker exec rsa_prod_backend python3 -c "
from app.celery_app import run_pipeline_scan
run_pipeline_scan.delay()
print('Task triggered!')
"
```

### Nginx 502 Bad Gateway

**Gejala:** Nginx return 502 saat mengakses API atau frontend

**Solusi:**
```bash
# 1. Cek apakah backend & frontend running
docker compose -f docker-compose.prod.yml ps

# 2. Cek Nginx error log
docker logs rsa_prod_nginx --tail 50

# 3. Test upstream langsung
docker exec rsa_prod_nginx curl -s http://backend:8000/health
docker exec rsa_prod_nginx curl -s http://frontend:3000

# 4. Reload nginx config
docker exec rsa_prod_nginx nginx -s reload
```

### Container OOM (Out of Memory)

**Gejala:** Container restart terus-menerus atau `OOMKilled` di status

**Solusi:**
```bash
# Cek memory usage
docker stats

# Tambah memory limit di docker-compose.prod.yml
# services:
#   backend:
#     mem_limit: 1g
#     mem_reservation: 512m

# Atau kurangi concurrency celery
# celery_worker:
#   command: celery -A app.celery_app worker --loglevel=warning --concurrency=1
```

---

## Referensi File Penting

| File | Keterangan |
|------|------------|
| `docker-compose.prod.yml` | Konfigurasi production Docker Compose |
| `docker-compose.yml` | Konfigurasi development Docker Compose |
| `.env.production` | Environment variables production |
| `.env.example` | Template environment variables |
| `nginx/nginx.conf` | Konfigurasi Nginx reverse proxy |
| `nginx/certs/` | Direktori SSL certificates |
| `start.sh` | Script startup (dev/prod/seed/build) |
| `stop.sh` | Script shutdown (dev/prod/all/clean) |
| `.github/workflows/ci.yml` | CI/CD pipeline GitHub Actions |
| `backend/Dockerfile` | Dockerfile backend (python:3.11-slim) |
| `frontend/Dockerfile` | Dockerfile frontend (node:20-slim, multi-stage) |
| `backend/app/config.py` | Konfigurasi aplikasi (Pydantic Settings) |
| `backend/app/db/init.sql` | SQL inisialisasi database |
| `backend/app/db/seed.py` | Script seeding database |
