# RenRND Sales Agentic AI

> **Platform AI agen untuk otomatisasi siklus penjualan** — dari deteksi peluang, pengelolaan pipeline, hingga dashboard real-time.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![License](https://img.shields.io/badge/license-MIT-purple)

---

## Daftar Isi

1. [Ringkasan](#1-ringkasan)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Prasyarat](#4-prasyarat)
5. [Instalasi & Setup](#5-instalasi--setup)
6. [Struktur Proyek](#6-struktur-proyek)
7. [Backend API](#7-backend-api)
8. [AI Agents](#8-ai-agents)
9. [Frontend](#9-frontend)
10. [Tableau Dashboard](#10-tableau-dashboard)
11. [Deployment](#11-deployment)
12. [Testing](#12-testing)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Ringkasan

RenRND Sales Agentic AI adalah platform berbasis AI agen yang mengotomatisasi seluruh siklus penjualan:

- **Opportunity Agent** — Mendeteksi peluang dari teks mentah (email, catatan meeting), ekstrak entitas dengan BANT scoring, dan auto-create opportunity di database.
- **Pipeline Agent** — Evaluasi semua deal aktif, update win probability, berikan rekomendasi next best action dan risk flags.
- **Insight Agent** — Generate daily briefing narasi, revenue forecast, dan deteksi anomali.

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| Auto Lead Detection | AI mengekstrak entitas dari teks raw menggunakan NER |
| BANT Scoring | Skor lead berdasarkan Budget, Authority, Need, Timeline |
| Pipeline Kanban | Drag & drop opportunity antar stage |
| Win Probability | LLM memprediksi probabilitas closing setiap deal |
| Daily Briefing | Narasi harian dengan insight, alert, dan rekomendasi |
| Dashboard Real-Time | Visualisasi funnel, forecast, dan rep performance |
| Tableau Integration | Embed Tableau workbook untuk analitik advanced |
| Background Tasks | Celery menjalankan pipeline scan (per jam) & briefing (per hari) |

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                   USER INTERFACE                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Next.js   │  │ Pipeline │  │ Tableau Dashboard    │   │
│  │ Dashboard │  │ Kanban   │  │ (Embedded via JS API)│   │
│  └─────┬─────┘  └─────┬────┘  └──────────┬───────────┘   │
└────────┼──────────────┼───────────────────┼───────────────┘
         │              │                   │
┌────────▼──────────────▼───────────────────▼───────────────┐
│                    API GATEWAY (FastAPI)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Oppor-   │ │ Pipeline │ │ Dashboard│ │ Agent API    │  │
│  │ tunity   │ │ API      │ │ API      │ │ (trigger)    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└────────┬──────────────┬───────────────────┬───────────────┘
         │              │                   │
┌────────▼──────────────▼───────────────────▼───────────────┐
│                  AGENTIC AI CORE                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────────┐ │
│  │ Opportunity│ │ Pipeline   │ │ Insight & Forecast     │ │
│  │ Agent      │ │ Agent      │ │ Agent                  │ │
│  ├────────────┤ ├────────────┤ ├────────────────────────┤ │
│  │ NER (lite) │ │ Stage eval │ │ Revenue forecast       │ │
│  │ BANT (pro) │ │ Win prob   │ │ Anomaly detection      │ │
│  │ Auto-create│ │ Next action│ │ Daily briefing          │ │
│  └────────────┘ └────────────┘ └────────────────────────┘ │
│                                                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  LLM Engine: BytePlus ModelArk (Skylark-pro/lite)      │ │
│  │  + RAG (Skylark Embedding + pgvector)                   │ │
│  └───────────────────────────────────────────────────────┘ │
└────────┬──────────────┬───────────────────┬───────────────┘
         │              │                   │
┌────────▼──────────────▼───────────────────▼───────────────┐
│                  DATA & STORAGE                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │PostgreSQL│ │ Redis    │ │ pgvector │ │ Celery       │  │
│  │ (main DB)│ │ (cache/  │ │ (vector  │ │ (background  │  │
│  │          │ │  queue)  │ │ storage) │ │  tasks)      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### Backend & AI

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| API Server | Python + FastAPI | 0.115.0 |
| LLM Engine | BytePlus ModelArk (Skylark) | OpenAI-compatible API |
| LLM (Reasoning) | skylark-pro | Input $0.40/M, Output $1.60/M tokens |
| LLM (Simple) | skylark-lite | Input $0.10/M, Output $0.40/M tokens |
| Embedding | skylark-embedding-vision | $0.125/M text tokens |
| Agent Framework | LangGraph | 0.2.34 |
| Vector Storage | pgvector (PostgreSQL extension) | 0.3.4 |
| Task Queue | Celery + Redis | 5.4.0 / 5.0.8 |
| Database | PostgreSQL 16 | |
| ORM | SQLAlchemy 2.0 (async) | 2.0.35 |
| Validation | Pydantic v2 | 2.9.0 |

### Frontend

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| Web UI | Next.js 14 (App Router) | 14.2.15 |
| Language | TypeScript | 5.6.3 |
| Styling | Tailwind CSS | 3.4.13 |
| Charts | Recharts | 2.12.7 |
| Icons | Lucide React | 0.451.0 |

### DevOps

| Komponen | Teknologi |
|----------|-----------|
| Containerization | Docker + Docker Compose |
| Database Image | pgvector/pgvector:pg16 |
| Cache Image | redis:7-alpine |
| Backend Image | python:3.11-slim |
| Frontend Image | node:20-slim (multi-stage) |

---

## 4. Prasyarat

### Software yang Dibutuhkan

```bash
# 1. Docker & Docker Compose (wajib)
docker --version          # min v24.x
docker compose version    # min v2.x

# 2. Python 3.10+ (untuk development lokal tanpa Docker)
python3 --version         # min 3.10

# 3. Node.js 20+ (untuk development frontend)
node --version             # min v20.x
npm --version

# 4. Git
git --version
```

### Akun BytePlus ModelArk

1. Buka https://console.byteplus.com/
2. Daftar akun dan navigasi ke **ModelArk > Model Activation**
3. Aktifkan model:
   - `skylark-pro` (untuk reasoning kompleks)
   - `skylark-lite` (untuk NER/classification)
   - `skylark-embedding-vision` (untuk embedding)
4. Navigasi ke **ModelArk > API Key Management**
5. Create API Key → simpan sebagai `ARK_API_KEY`

---

## 5. Instalasi & Setup

### 5.1 Clone & Setup Environment

```bash
# Clone proyek (atau gunakan folder yang sudah ada)
cd /path/to/renrnd-sales-agentic

# Copy environment template
cp .env.example .env

# Edit .env dan isi API key Anda
# ARK_API_KEY=your_actual_api_key_here
```

### 5.2 Jalankan dengan Docker (Recommended)

```bash
# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Tunggu hingga healthy
docker compose ps

# Start backend
docker compose up -d backend

# Start Celery worker & beat (untuk background tasks)
docker compose up -d celery_worker celery_beat

# Start frontend
docker compose up -d frontend
```

### 5.3 Jalankan tanpa Docker (Development)

```bash
# 1. Start PostgreSQL + Redis via Docker
docker compose up -d postgres redis

# 2. Install backend dependencies
cd backend
pip3 install --break-system-packages -r requirements.txt

# 3. Run backend
uvicorn app.main:app --reload --port 8000

# 4. Install frontend dependencies (terminal baru)
cd frontend
npm install

# 5. Run frontend
npm run dev
```

### 5.4 Seed Database dengan Data Dummy

```bash
cd backend
python3 -m app.db.seed
```

Data yang di-seed:
- 4 Users (sales reps)
- 8 Accounts (perusahaan)
- 8 Contacts
- 20 Opportunities (dengan berbagai stage)
- 45 Activities
- 10 Tasks

### 5.5 Verifikasi

```bash
# Cek backend
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# Cek API
curl http://localhost:8000/api/v1/stages | python3 -m json.tool

# Buka Swagger UI
open http://localhost:8000/docs

# Buka frontend
open http://localhost:3000
```

---

## 6. Struktur Proyek

```
renrnd-sales-agentic/
├── docker-compose.yml            # Docker Compose (dev)
├── docker-compose.prod.yml       # Docker Compose (production)
├── .env.example                  # Environment template (dev)
├── .env.production               # Environment template (prod)
├── .dockerignore                 # Root dockerignore
├── .gitignore
├── README.md                     # Dokumentasi ini
├── RENCANA_APLIKASI_AGENTIC_AI_SALES.md  # Rencana lengkap
├── RenRND_Sales_Agentic_AI_PitchDeck.pptx # Pitch deck
│
├── .github/
│   └── workflows/
│       └── ci.yml                # CI/CD (GitHub Actions)
│
├── nginx/
│   ├── nginx.conf                # Nginx reverse proxy config
│   └── certs/                    # SSL certificates (.gitkeep)
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_api.py           # Pytest unit tests
│   │   └── test_e2e.py           # E2E test (9 skenario)
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI entry point
│       ├── config.py            # Konfigurasi (Pydantic Settings)
│       ├── llm_client.py        # BytePlus ModelArk LLM client
│       ├── celery_app.py        # Celery background tasks
│       │
│       ├── db/
│       │   ├── __init__.py
│       │   ├── database.py      # Async engine & session
│       │   ├── init.sql         # Schema SQL (auto-run on first start)
│       │   └── seed.py          # Seed data script
│       │
│       ├── models/
│       │   └── __init__.py      # 8 SQLAlchemy ORM models
│       │
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── opportunity.py   # Opportunity CRUD schemas
│       │   └── common.py        # Stage, Activity, Task, Account, dll
│       │
│       ├── api/
│       │   ├── __init__.py
│       │   └── v1/
│       │       ├── __init__.py
│       │       ├── opportunities.py  # CRUD opportunities
│       │       ├── stages.py          # List stages
│       │       ├── activities.py      # CRUD activities
│       │       ├── tasks.py           # CRUD tasks
│       │       ├── accounts.py        # CRUD accounts & contacts
│       │       ├── dashboard.py       # Dashboard metrics + mat views
│       │       └── agents.py          # AI agent trigger endpoints
│       │
│       └── agents/
│           ├── __init__.py
│           ├── opportunity_agent.py   # NER + BANT + auto-create
│           ├── pipeline_agent.py      # Deal evaluation + win prob
│           ├── insight_agent.py       # Daily briefing + forecast
│           ├── prompts/
│           │   └── __init__.py
│           └── tools/
│               ├── __init__.py
│               └── opportunity_tools.py  # Function calling tools
│
├── frontend/
│   ├── Dockerfile               # Multi-stage build
│   ├── .dockerignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       # Root layout (Sidebar + Header)
│       │   ├── globals.css      # Global styles
│       │   ├── page.tsx         # Dashboard (stat cards + charts)
│       │   ├── error.tsx        # Error boundary
│       │   ├── pipeline/
│       │   │   └── page.tsx     # Pipeline Kanban (drag & drop)
│       │   ├── opportunities/
│       │   │   ├── page.tsx    # Opportunities list
│       │   │   ├── new/
│       │   │   │   └── page.tsx # Create form
│       │   │   └── [id]/
│       │   │       └── page.tsx # Detail + inline edit
│       │   ├── agents/
│       │   │   └── page.tsx     # AI Agents trigger page
│       │   └── analytics/
│       │       └── page.tsx     # Analytics + Tableau embed
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx  # Navigation sidebar
│       │   │   └── Header.tsx  # Page header
│       │   └── ui/
│       │       └── Card.tsx     # Card, StatCard, Badge components
│       │
│       ├── lib/
│       │   ├── api.ts           # API client (fetch wrapper)
│       │   └── utils.ts         # Helper functions
│       │
│       └── types/
│           └── index.ts         # TypeScript interfaces
│
├── tableau/
│   └── workbooks/               # Tableau workbook files
│
└── docs/
    ├── api/
    ├── architecture/
    └── user-guide/
```

---

## 7. Backend API

### Base URL

```
http://localhost:8000/api/v1
```

### Swagger UI

```
http://localhost:8000/docs
```

### Endpoints

#### Opportunities

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/opportunities` | List semua opportunities (params: `skip`, `limit`) |
| POST | `/opportunities` | Buat opportunity baru |
| GET | `/opportunities/{id}` | Detail opportunity |
| PATCH | `/opportunities/{id}` | Update opportunity |
| DELETE | `/opportunities/{id}` | Hapus opportunity |

#### Stages

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/stages` | List semua pipeline stages |

#### Activities

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/activities` | List activities (params: `opp_id`) |
| POST | `/activities` | Buat activity baru |
| DELETE | `/activities/{id}` | Hapus activity |

#### Tasks

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/tasks` | List tasks (params: `opp_id`, `status`) |
| POST | `/tasks` | Buat task baru |
| PATCH | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Hapus task |

#### Accounts & Contacts

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/accounts` | List semua accounts |
| POST | `/accounts` | Buat account baru |
| GET | `/accounts/{id}/contacts` | List contacts untuk account |
| POST | `/accounts/contacts` | Buat contact baru |

#### Dashboard

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/dashboard/summary` | Pipeline summary per stage |
| GET | `/dashboard/forecast` | Weighted forecast per bulan |
| GET | `/dashboard/rep-performance` | Sales rep performance |

#### AI Agents

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/agents/opportunity/run` | Trigger Opportunity Agent |
| POST | `/agents/pipeline/scan` | Trigger Pipeline Agent |
| GET | `/agents/insight/briefing` | Get Daily Briefing |

### Contoh Penggunaan

```bash
# List opportunities
curl http://localhost:8000/api/v1/opportunities?limit=5

# Create opportunity
curl -X POST http://localhost:8000/api/v1/opportunities \
  -H "Content-Type: application/json" \
  -d '{"name": "PT ABC - CRM System", "value": 250000000}'

# Trigger Opportunity Agent
curl -X POST http://localhost:8000/api/v1/agents/opportunity/run \
  -H "Content-Type: application/json" \
  -d '{"raw_input": "PT Maju Jaya butuh CRM, budget 500jt, Budi CTO, keputusan 2 bulan"}'

# Get dashboard summary
curl http://localhost:8000/api/v1/dashboard/summary
```

---

## 8. AI Agents

### Model Tiering Strategy

| Task | Model | Biaya | Alasan |
|------|-------|-------|--------|
| NER / Entity Extraction | skylark-lite | $0.10-$0.40/M | Cepat & murah untuk klasifikasi |
| BANT Scoring | skylark-pro | $0.40-$1.60/M | Reasoning kompleks diperlukan |
| Pipeline Evaluation | skylark-pro | $0.40-$1.60/M | Analisis multi-faktor |
| Daily Briefing | skylark-pro | $0.40-$1.60/M | Generasi narasi |
| Embedding | skylark-embedding-vision | $0.125/M | Semantic search |

### Opportunity Agent Workflow

```
Input: Raw text (email/meeting note)
  ↓
Step 1: Entity Extraction (skylark-lite)
  → company_name, contact_name, need, budget, timeline
  ↓
Step 2: BANT Scoring (skylark-pro)
  → budget: 0-1, authority: 0-1, need: 0-1, timeline: 0-1
  → total score: 0-1
  ↓
Step 3: Decision
  → If total > 0.5: auto-create opportunity
  → If total <= 0.5: log only, no creation
  ↓
Step 4: Logging
  → AgentLog entry di database
  ↓
Output: entities, bant_score, opportunity_created
```

### Pipeline Agent Workflow

```
Input: All active opportunities
  ↓
For each opportunity:
  → Get context (stage, value, activities, close_date)
  → LLM evaluation (skylark-pro):
    - should_advance: boolean
    - target_stage: next stage or null
    - updated_win_probability: 0.0-1.0
    - next_best_action: {action, description, priority}
    - risk_flags: list of concerns
  → Update win_probability in DB (validated 0.0-1.0)
  → Log evaluation
  ↓
Output: List of evaluations for all deals
```

### Insight Agent Workflow

```
Input: Pipeline metrics (aggregated from DB)
  → total_weighted_pipeline
  → total_open_deals
  → avg_win_probability
  ↓
LLM generates briefing (skylark-pro):
  → summary: 2-3 kalimat ringkasan
  → insights: list of interesting observations
  → alerts: list of action items
  → recommendation: main recommendation
  ↓
Output: {metrics, briefing}
```

### Celery Background Tasks

| Task | Schedule | Deskripsi |
|------|----------|-----------|
| `tasks.scan_pipeline` | Setiap 1 jam | Pipeline Agent evaluasi semua deal |
| `tasks.daily_briefing` | Setiap 24 jam | Insight Agent daily briefing |

---

## 9. Frontend

### Halaman yang Tersedia

| Route | Halaman | Fitur |
|-------|---------|-------|
| `/` | Dashboard | 4 stat cards, bar chart funnel, pie chart distribusi, tabel opportunities terbaru |
| `/pipeline` | Pipeline Kanban | Drag & drop opportunity antar stage dengan optimistic update |
| `/opportunities` | Opportunities List | Tabel dengan filter, win prob bar, badge sumber |
| `/opportunities/new` | Create Form | Form pembuatan opportunity manual |
| `/opportunities/[id]` | Detail + Edit | Inline editing, aktivitas timeline, AI metadata |
| `/agents` | AI Agents | Trigger 3 agents: Opportunity, Pipeline, Insight |
| `/analytics` | Analytics + Tableau | Bar chart, line chart forecast, Tableau iframe embed |

### API Client

Frontend menggunakan fetch wrapper di `src/lib/api.ts`:

```typescript
// GET
const data = await apiFetch<Opportunity[]>("/opportunities");

// POST
const result = await apiPost<Record<string, unknown>>("/agents/opportunity/run", {
  raw_input: "PT ABC butuh CRM..."
});

// PATCH
const updated = await apiPatch<Opportunity>(`/opportunities/${id}`, {
  stage_id: newStageId
});

// DELETE
await apiDelete(`/opportunities/${id}`);
```

---

## 10. Tableau Dashboard

### Setup Tableau Connection

1. Buka **Tableau Desktop**
2. Connect → To a Server → PostgreSQL
3. Isi koneksi:
   - Server: `localhost`
   - Port: `5432`
   - Database: `rsa_sales`
   - Username: `rsa_admin`
   - Password: `<your_postgres_password>`
4. Pilih tables: `opportunities`, `stages`, `mv_funnel_summary`, `mv_forecast_data`, `mv_rep_performance`

### Buat Workbook

**Sheet 1: Sales Funnel**
- Drag `Stage Name` ke Columns
- Drag `Total Value` ke Rows → Sum
- Marks: Bar Chart

**Sheet 2: Revenue Forecast**
- Drag `Close Month` ke Columns
- Drag `Weighted Pipeline` ke Rows → Line
- Drag `Unweighted Pipeline` ke Rows → Line (dashed)

**Sheet 3: Rep Performance**
- Drag `Rep Name` ke Rows
- Drag `Won Revenue` ke Columns → Bar
- Drag `Quota` ke Columns → Reference Line

### Publish & Embed

1. Server → Publish Workbook
2. Copy embed URL
3. Buka `http://localhost:3000/analytics`
4. Paste URL di input "Tableau Embed URL"

---

## 11. Deployment

### 11.1 Development Deployment (Docker Compose)

```bash
# Set environment
cp .env.example .env
# Edit .env: ARK_API_KEY=your_api_key

# Build & start semua services (dev mode)
docker compose up -d --build

# Cek status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f celery_worker
```

### 11.2 Production Deployment (docker-compose.prod.yml)

Production menggunakan **gunicorn** (4 workers), **Celery** (worker + beat), dan **Nginx** reverse proxy.

#### Step 1: Konfigurasi Environment Production

```bash
# Copy template
cp .env.production .env.prod

# Edit .env.prod — ISI SEMUA INI:
#   ARK_API_KEY        = your_production_byteplus_api_key
#   POSTGRES_PASSWORD  = your_strong_db_password
#   JWT_SECRET         = your_secure_jwt_secret_min_32_chars
#   NEXT_PUBLIC_API_URL = https://your-domain.com   (jika pakai domain)
```

#### Step 2: Setup SSL Certificate (Optional, untuk HTTPS)

```bash
# Self-signed (testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/CN=localhost"

# Production: gunakan Let's Encrypt
# sudo certbot certonly --standalone -d your-domain.com
# sudo cp /etc/letsencrypt/live/your-domain.com/{fullchain,privkey}.pem nginx/certs/
```

#### Step 3: Build & Start Production Stack

```bash
# Load env vars
export $(grep -v '^#' .env.prod | xargs)

# Build & start semua 7 services
docker compose -f docker-compose.prod.yml up -d --build

# Cek status semua container
docker compose -f docker-compose.prod.yml ps

# Cek logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
```

**7 Production Services:**

| Service | Container | Port | Deskripsi |
|---------|-----------|------|-----------|
| `postgres` | rsa_prod_postgres | 5432 | PostgreSQL 16 + pgvector |
| `redis` | rsa_prod_redis | 6379 | Redis 7 (cache + queue) |
| `backend` | rsa_prod_backend | 8000 | FastAPI + gunicorn (4 workers) |
| `celery_worker` | rsa_prod_celery_worker | — | Background task runner |
| `celery_beat` | rsa_prod_celery_beat | — | Scheduled task scheduler |
| `frontend` | rsa_prod_frontend | 3000 | Next.js 14 (production build) |
| `nginx` | rsa_prod_nginx | 80, 443 | Reverse proxy + SSL |

#### Step 4: Seed Database (First Run Only)

```bash
# Execute seed script inside backend container
docker exec -it rsa_prod_backend python3 -m app.db.seed
```

#### Step 5: Verifikasi Production

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# API test
curl http://localhost:8000/api/v1/stages | python3 -m json.tool

# Frontend
curl -I http://localhost:3000
# Expected: HTTP/1.1 200

# Nginx (port 80/443)
curl -I http://localhost
# Expected: HTTP/1.1 200
```

### 11.3 Nginx Reverse Proxy

File konfigurasi: `nginx/nginx.conf`

```
Internet → Nginx (80/443)
                 ├─ /api/*     → Backend (8000)
                 ├─ /docs      → Backend Swagger
                 └─ /*         → Frontend (3000)
```

Fitur Nginx:
- SSL/TLS termination (HTTPS)
- Security headers (X-Frame-Options, X-Content-Type-Options, dll)
- Gzip compression
- Reverse proxy ke backend & frontend
- Rate limiting (opsional, uncomment di config)

### 11.4 Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `ARK_API_KEY` | (required) | BytePlus ModelArk API key |
| `ARK_BASE_URL` | `https://ark.ap-southeast.bytepluses.com/api/v3` | BytePlus API base URL |
| `LLM_MODEL_PRO` | `skylark-pro` | Model untuk reasoning kompleks |
| `LLM_MODEL_LITE` | `skylark-lite` | Model untuk task sederhana |
| `EMBEDDING_MODEL` | `skylark-embedding-vision` | Model untuk embedding |
| `DATABASE_URL` | `postgresql+asyncpg://rsa_admin:<your_password>@localhost:5432/rsa_sales` | Database URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis URL |
| `JWT_SECRET` | `<your_jwt_secret>` | JWT secret key |
| `DEBUG` | `false` | Debug mode (echo SQL queries) |
| `POSTGRES_PASSWORD` | (required prod) | Password database production |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL backend untuk frontend |

### 11.5 CI/CD Pipeline (GitHub Actions)

File: `.github/workflows/ci.yml`

Pipeline otomatis berjalan pada setiap `push` ke `main` atau `pull_request`:

| Job | Deskripsi |
|-----|-----------|
| `backend-test` | Install Python deps → pytest → config check |
| `frontend-build` | Install npm deps → next build (type check) |
| `docker-build` | Validasi docker-compose.prod.yml + Dockerfile builds |

```yaml
# Trigger: push to main atau PR
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### 11.6 Production Checklist

- [ ] Set `ARK_API_KEY` dengan API key production
- [ ] Set `POSTGRES_PASSWORD` dengan password yang kuat
- [ ] Set `JWT_SECRET` dengan secret yang aman (min 32 karakter)
- [ ] Set `DEBUG=false`
- [ ] Setup SSL certificate (Let's Encrypt atau self-signed)
- [ ] Test `docker compose -f docker-compose.prod.yml config --quiet`
- [ ] Seed database dengan data awal
- [ ] Verifikasi semua endpoint API berfungsi
- [ ] Verifikasi frontend dapat diakses via Nginx
- [ ] Configure Tableau Server dengan SSL
- [ ] Setup monitoring (Grafana + Prometheus)
- [ ] Setup log aggregation (Loki + Promtail)
- [ ] Configure database backup schedule
- [ ] Setup auto-restart policy (`restart: unless-stopped` sudah aktif)

### 11.7 Docker Commands (Production)

```bash
# Start semua
docker compose -f docker-compose.prod.yml up -d --build

# Stop semua
docker compose -f docker-compose.prod.yml down

# Stop + hapes volumes (DANGER: data hilang!)
docker compose -f docker-compose.prod.yml down -v

# Restart satu service
docker compose -f docker-compose.prod.yml restart backend

# View logs (follow)
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f celery_worker
docker compose -f docker-compose.prod.yml logs -f nginx

# Execute command di container
docker exec -it rsa_prod_backend python3 -c "from app.config import settings; print(settings.APP_NAME)"
docker exec -it rsa_prod_postgres psql -U rsa_admin -d rsa_sales -c "SELECT COUNT(*) FROM opportunities;"

# Scale backend workers (horizontal)
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

---

## 12. Testing

### Backend Test

```bash
cd backend

# Test config
python3 -c "from app.config import settings; print('✅', settings.APP_NAME)"

# Test models
python3 -c "from app.models import Account, Opportunity, Stage, User, Contact, Activity, Task, AgentLog; print('✅ 8 models')"

# Test LLM client
python3 -c "from app.llm_client import chat_pro, chat_lite, embed_text; print('✅ LLM client')"

# Test agents
python3 -c "from app.agents.opportunity_agent import run_opportunity_agent; from app.agents.pipeline_agent import run_pipeline_agent; from app.agents.insight_agent import generate_daily_briefing; print('✅ 3 agents')"

# Test API
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/dashboard/summary
```

### Frontend Test

```bash
cd frontend

# Build test
npx next build

# Type check
npx tsc --noEmit
```

### E2E Test Flow

#### Automated E2E Test Script

File: `backend/tests/test_e2e.py` — Test otomatis 9 skenario end-to-end:

| # | Test | Validasi |
|---|------|----------|
| 1 | Health check | Backend `/health` returns 200 |
| 2 | List stages | `/api/v1/stages` returns 6 stages |
| 3 | Create opportunity | POST `/api/v1/opportunities` returns 201 |
| 4 | Get opportunity | GET `/api/v1/opportunities/{id}` returns data |
| 5 | Update opportunity | PATCH `/api/v1/opportunities/{id}` returns updated |
| 6 | Dashboard summary | GET `/api/v1/dashboard/summary` returns metrics |
| 7 | Dashboard forecast | GET `/api/v1/dashboard/forecast` returns monthly data |
| 8 | Pipeline scan | POST `/api/v1/agents/pipeline/scan` evaluates deals |
| 9 | Cleanup | DELETE opportunity returns 204 |

```bash
# 1. Start infrastructure
docker compose up -d postgres redis

# 2. Start backend
cd backend && uvicorn app.main:app --port 8000 &

# 3. Seed data
python3 -m app.db.seed

# 4. Jalankan E2E test
python3 tests/test_e2e.py

# Expected output:
# ✅ Test 1: Health Check — PASSED
# ✅ Test 2: List Stages — PASSED
# ✅ Test 3: Create Opportunity — PASSED
# ✅ Test 4: Get Opportunity — PASSED
# ✅ Test 5: Update Opportunity — PASSED
# ✅ Test 6: Dashboard Summary — PASSED
# ✅ Test 7: Dashboard Forecast — PASSED
# ✅ Test 8: Pipeline Agent Scan — PASSED
# ✅ Test 9: Cleanup — PASSED
# 🎉 All 9 E2E tests PASSED!
```

#### Manual Test Flow

```bash
# 1. Test API
curl http://localhost:8000/api/v1/opportunities | python3 -m json.tool | head -10
curl http://localhost:8000/api/v1/dashboard/summary | python3 -m json.tool

# 2. Test AI Agent (requires ARK_API_KEY)
curl -X POST http://localhost:8000/api/v1/agents/opportunity/run \
  -H "Content-Type: application/json" \
  -d '{"raw_input": "PT Test Corp butuh sistem CRM, budget 300jt, contact: John, CEO, keputusan 1 bulan"}'

# 3. Start frontend
cd frontend && npm run dev

# 4. Open browser
open http://localhost:3000
```

---

## 13. Troubleshooting

### Backend

**Problem: `ModuleNotFoundError: No module named 'app'`**

```bash
# Pastikan Anda berada di direktori backend/
cd backend
python3 -m app.db.seed  # gunakan -m flag, bukan python3 app/db/seed.py
```

**Problem: Database connection error**

```bash
# Pastikan PostgreSQL running
docker compose ps postgres
docker compose up -d postgres

# Test koneksi
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "SELECT 1;"
```

**Problem: pgvector extension not found**

```bash
# Re-create database volume
docker compose down -v
docker compose up -d postgres
sleep 5

# Verify
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "SELECT extname FROM pg_extension;"
# Should show: plpgsql, vector, uuid-ossp
```

**Problem: AI Agent returns error**

```bash
# Pastikan ARK_API_KEY sudah diset
echo $ARK_API_KEY

# Test koneksi BytePlus
python3 -c "
import asyncio
from app.llm_client import chat_lite
async def test():
    r = await chat_lite([{'role':'user','content':'hello'}])
    print('✅ LLM OK:', r.choices[0].message.content[:50])
asyncio.run(test())
"
```

### Frontend

**Problem: `Cannot find module 'next'`**

```bash
cd frontend
npm install
```

**Problem: API Error di browser**

```bash
# Pastikan backend running
curl http://localhost:8000/health

# Pastikan NEXT_PUBLIC_API_URL benar
# Default: http://localhost:8000
```

**Problem: Build error TypeScript**

```bash
cd frontend
npx tsc --noEmit  # cek type errors
npx next build    # build dengan error detail
```

### Docker

**Problem: Port already in use**

```bash
# Cek apa yang menggunakan port
lsof -i :8000  # backend
lsof -i :3000  # frontend
lsof -i :5432  # postgres
lsof -i :6379  # redis

# Stop service yang konflik atau ganti port di docker-compose.yml
```

**Problem: Docker daemon not running**

```bash
# macOS
open -a Docker
# Tunggu hingga Docker Desktop siap
docker info
```

---

## License

MIT License - Copyright (c) 2026 RenRND

---

## Tim

**Tim RnD Vanza** — Pengembangan & Maintenance

Untuk pertanyaan teknis, buka issue di repository atau hubungi tim development.
