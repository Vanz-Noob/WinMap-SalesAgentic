# Arsitektur Sistem — RenRND Sales Agentic AI

> Dokumen arsitektur teknis untuk platform **RenRND Sales Agentic AI**.
> Versi: 1.0.0 | Terakhir diperbarui: 2026-09-28

---

## Daftar Isi

1. [Overview](#1-overview)
2. [Diagram Komponen](#2-diagram-komponen)
3. [Request Flow](#3-request-flow)
4. [AI Agent Pipeline Flow](#4-ai-agent-pipeline-flow)
5. [Tech Stack](#5-tech-stack)
6. [Design Decisions](#6-design-decisions)
7. [Security Architecture](#7-security-architecture)
8. [Scalability Notes](#8-scalability-notes)

---

## 1. Overview

RenRND Sales Agentic AI menggunakan **arsitektur 3-layer** yang dirancang untuk
menangani pipeline sales yang kompleks dengan integrasi AI agent secara
real-time maupun background processing.

### Lapisan Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 1: Frontend                            │
│   Next.js 14 (App Router) + Tailwind + Recharts                 │
│   Port: 3000  |  SSR/CSR  |  React Query + Zustand              │
├─────────────────────────────────────────────────────────────────┤
│                  Layer 2: API Gateway                            │
│   Nginx Reverse Proxy (port 80/443)                             │
│   SSL Termination · Security Headers · Gzip · Rate Limiting      │
├─────────────────────────────────────────────────────────────────┤
│              Layer 3: Agentic AI Core                           │
│   FastAPI Backend (port 8000) — gunicorn + uvicorn workers       │
│   ├─ REST API (accounts, opportunities, agents, dashboard)      │
│   ├─ AI Agents (Opportunity · Pipeline · Insight)               │
│   └─ Celery Worker + Beat (background tasks)                     │
├─────────────────────────────────────────────────────────────────┤
│                   Layer 4: Data Layer                            │
│   PostgreSQL 16 + pgvector (persistent)                          │
│   Redis 7 (cache · Celery broker/backend)                       │
│   BytePlus ModelArk (external LLM API)                           │
└─────────────────────────────────────────────────────────────────┘
```

### Prinsip Desain

| Prinsip | Implementasi |
|---|---|
| **Separation of Concerns** | Frontend, API Gateway, Backend, Data Layer terpisah sebagai service Docker independen |
| **Async-First** | Seluruh stack menggunakan async I/O — dari FastAPI hingga SQLAlchemy dan LLM client |
| **AI-Native** | Tiga AI Agent (Opportunity, Pipeline, Insight) terintegrasi di core, bukan add-on |
| **Background Processing** | Task berat (pipeline scan, daily briefing) berjalan via Celery, tidak memblokir API |
| **Observable** | Setiap aksi AI Agent dicatat di tabel `agent_logs` untuk audit trail |

---

## 2. Diagram Komponen

```
                              ┌──────────────────────────┐
                              │       Browser/User        │
                              │   (Chrome, Firefox, dll)  │
                              └─────────────┬────────────┘
                                            │ HTTPS
                                            ▼
                    ┌───────────────────────────────────────────┐
                    │       Nginx Reverse Proxy (port 80/443)    │
                    │                                            │
                    │  ┌─────────┐  ┌────────┐  ┌────────────┐ │
                    │  │ SSL/TLS │  │ Gzip   │  │ Security   │ │
                    │  │ Term.   │  │ Comp.  │  │ Headers    │ │
                    │  └─────────┘  └────────┘  └────────────┘ │
                    │                                            │
                    │  /api/*  ───────► backend:8000            │
                    │  /docs   ───────► backend:8000            │
                    │  /health ───────► backend:8000            │
                    │  /      ────────► frontend:3000            │
                    └──────────┬──────────────────┬─────────────┘
                               │                  │
                  ┌────────────┘                  └────────────┐
                  ▼                                              ▼
    ┌──────────────────────────────┐           ┌──────────────────────────┐
    │  FastAPI Backend (port 8000)  │           │  Next.js Frontend        │
    │  gunicorn -w 4 uvicorn       │           │  (port 3000)              │
    │                               │           │                           │
    │  ┌─────────────────────────┐ │           │  ┌──────────────────────┐ │
    │  │ API Routes (/api/v1)    │ │           │  │ Dashboard            │ │
    │  │  accounts · contacts    │ │           │  │ Pipeline (Kanban)    │ │
    │  │  opportunities · stages │ │           │  │ Opportunities CRUD   │ │
    │  │  activities · tasks     │ │           │  │ Analytics (Recharts) │ │
    │  │  agents · dashboard     │ │           │  │ Agents Panel         │ │
    │  └───────────┬─────────────┘ │           │  └──────────────────────┘ │
    │              │                 │           │                           │
    │  ┌───────────▼─────────────┐ │           │  State: React Query       │
    │  │   AI Agent Core          │ │           │  Store: Zustand           │
    │  │  ┌──────────────────┐    │ │           └──────────────────────────┘
    │  │  │ Opportunity Agent│    │ │
    │  │  │  (NER + BANT)    │    │ │
    │  │  └──────────────────┘    │ │
    │  │  ┌──────────────────┐    │ │
    │  │  │ Pipeline Agent   │    │ │
    │  │  │  (stage eval)     │    │ │
    │  │  └──────────────────┘    │ │
    │  │  ┌──────────────────┐    │ │
    │  │  │ Insight Agent     │    │ │
    │  │  │  (briefing)       │    │ │
    │  │  └──────────────────┘    │ │
    │  └───────────┬─────────────┘ │
    │              │                 │
    │  ┌───────────▼─────────────┐ │
    │  │  SQLAlchemy 2.0 (async) │ │
    │  │  Pydantic v2 (schemas)  │ │
    │  └───────────┬─────────────┘ │
    └──────────────┼────────────────┘
                   │
         ┌─────────┴──────────────────────────┐
         │                                     │
         ▼                                     ▼
    ┌──────────────────────┐         ┌──────────────────────┐
    │  Celery Worker + Beat │         │  PostgreSQL 16        │
    │                       │         │  + pgvector           │
    │  Beat Schedule:       │         │  (port 5432)          │
    │  ├─ pipeline scan /1h │         │                       │
    │  └─ briefing /24h     │         │  Tables:              │
    │                       │         │  accounts, contacts   │
    │  Broker: Redis        │         │  stages, users        │
    └──────────┬────────────┘         │  opportunities        │
               │                       │  activities, tasks    │
               ▼                       │  agent_logs           │
    ┌──────────────────────┐         │                       │
    │  Redis 7 (port 6379)  │         │  + 3 Materialized     │
    │                       │         │    Views              │
    │  ├─ Celery broker     │         │  + ivfflat index      │
    │  ├─ Celery backend    │         │                       │
    │  └─ Cache              │         └──────────────────────┘
    └──────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │  BytePlus ModelArk (External LLM API)     │
    │  https://ark.ap-southeast.bytepluses.com  │
    │                                            │
    │  ├─ skylark-pro        (reasoning kompleks)│
    │  ├─ skylark-lite       (NER, klasifikasi)  │
    │  └─ skylark-embedding-vision (embedding)   │
    └──────────────────────────────────────────┘
```

### Port Mapping

| Service | Container Port | Host Port | Keterangan |
|---------|---------------|-----------|------------|
| Nginx | 80, 443 | 80, 443 | Reverse proxy, SSL termination |
| Frontend (Next.js) | 3000 | 3000 | SSR + static assets |
| Backend (FastAPI) | 8000 | 8000 | REST API + AI agents |
| PostgreSQL | 5432 | 5432 | Database + pgvector |
| Redis | 6379 | 6379 | Cache + Celery broker/backend |

---

## 3. Request Flow

Berikut adalah alur lengkap sebuah request HTTP dari browser hingga database.

### 3.1 Normal API Request (Contoh: GET /api/v1/opportunities)

```
Browser
  │
  │  1. User mengklik "Lihat Opportunities" di dashboard
  │     React Query mengirim GET /api/v1/opportunities
  │
  ▼
Nginx (port 443)
  │
  │  2. SSL Termination — dekripsi TLS
  │  3. Route matching: /api/* → proxy_pass backend_upstream
  │  4. Tambah header: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
  │  5. Gzip response (jika content-type cocok)
  │
  ▼
FastAPI (port 8000) — gunicorn worker (uvicorn)
  │
  │  6. ASGI event loop menerima request
  │  7. Middleware: CORS check (origin: localhost:3000)
  │  8. Router matching: /api/v1/opportunities → opportunities.router
  │  9. Dependency injection: get_db() → AsyncSession dari pool
  │
  ▼
SQLAlchemy Async (asyncpg driver)
  │
  │  10. Query: SELECT * FROM opportunities
  │      JOIN stages ON opportunities.stage_id = stages.id
  │  11. Connection pool (asyncpg) → PostgreSQL
  │
  ▼
PostgreSQL 16 + pgvector
  │
  │  12. Eksekusi query, gunakan index (idx_opp_stage, dll)
  │  13. Return result set
  │
  ▼  (data flows back up)
SQLAlchemy → FastAPI serializer (Pydantic v2) → JSON response
  │
  ▼
Nginx → Browser → React Query cache → Re-render UI (Recharts/Table)
```

### 3.2 AI Agent Request (Contoh: POST /api/v1/agents/opportunity)

```
Browser
  │  POST /api/v1/agents/opportunity { raw_input: "PT Maju jaya, kontak Budi,
  │  butuh CRM, budget 200jt, Q1 2026" }
  ▼
Nginx → FastAPI
  │
  ▼
Opportunity Agent (run_opportunity_agent)
  │
  ├─ Step 1: extract_entities()
  │    │
  │    └─► BytePlus ModelArk (skylark-lite)
  │         NER: { company_name, contact_name, need, budget, ... }
  │
  ├─ Step 2: tool_score_lead_bant()
  │    │
  │    └─► BytePlus ModelArk (skylark-pro)
  │         BANT scoring: { budget: 0.8, authority: 0.5, need: 0.9, ... }
  │
  ├─ Step 3: IF bant_score.total > 0.5 → tool_create_opportunity()
  │    │
  │    ├─► embed_text() → BytePlus ModelArk (skylark-embedding-vision)
  │    │    Generate embedding 1024-dim untuk vector search
  │    │
  │    ├─► Cari/buat Account di PostgreSQL
  │    ├─► Ambil stage "Prospecting" (order=1)
  │    └─► INSERT opportunity + embedding vector(1024)
  │
  ├─ Step 4: INSERT agent_logs (audit trail)
  │
  └─► Return JSON ke browser
```

### 3.3 Background Task Flow (Celery)

```
Celery Beat (scheduler)
  │
  ├─ Setiap 3600 detik (1 jam) → trigger task "tasks.scan_pipeline"
  │
  └─ Setiap 86400 detik (24 jam) → trigger task "tasks.daily_briefing"
        │
        ▼
  Redis (broker)
        │  Push task message ke queue
        ▼
  Celery Worker
        │
        ├─ Pop task dari Redis
        ├─ _run_async() — buat event loop baru + NullPool engine
        │
        ├─ [scan_pipeline] → run_pipeline_agent()
        │    Scan semua active opportunities, evaluasi tiap deal:
        │    ┌─ Chat ke skylark-pro (reasoning stage transition)
        │    ├─ Update win_probability di DB
        │    └─ Log ke agent_logs
        │
        └─ [daily_briefing] → generate_daily_briefing()
             Aggregate metrics → chat skylark-pro → generate narasi
             Simpan briefing di agent_logs
```

---

## 4. AI Agent Pipeline Flow

RenRND Sales Agentic AI memiliki **tiga AI Agent** yang bekerja secara
berurutan dan kolaboratif dalam pipeline sales.

### 4.1 Opportunity Agent (Deteksi & Kreasi Lead)

**Tujuan:** Mendeteksi dan membuat opportunity baru dari input mentah
(chat, email, catatan sales, dll).

**Model:** skylark-lite (NER) + skylark-pro (BANT scoring)

```
Raw Input Text
  │
  ▼
┌──────────────────────────────┐
│  1. Entity Extraction         │  Model: skylark-lite (cepat, murah)
│  extract_entities()           │  Output: { company_name, contact_name,
│  Temperature: 0.2             │    contact_email, need, budget_mentioned,
│                               │    timeline, sentiment }
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  2. BANT Scoring              │  Model: skylark-pro (reasoning)
│  tool_score_lead_bant()       │  Output: { budget: 0-1, authority: 0-1,
│  Temperature: 0.3             │    need: 0-1, timeline: 0-1, total: 0-1 }
└──────────────┬───────────────┘
               │
               ▼
       total > 0.5 ?
       ┌────┴────┐
      YA        TIDAK
       │         │
       ▼         ▼
┌────────────┐  ┌──────────────┐
│ 3. Create   │  │ Skip (lead    │
│ Opportunity │  │ tidakQualified)│
│             │  └──────────────┘
│ ├ embed_text()
│ │  (skylark-embedding-vision,
│ │   1024-dim vector)
│ │
│ ├ Cari/buat Account
│ ├ Set stage = Prospecting
│ └ INSERT opportunity
│    + embedding vector(1024)
└──────┬─────┘
       │
       ▼
┌──────────────────────────────┐
│  4. Audit Log                 │
│  INSERT agent_logs            │
│  agent_type = "opportunity"   │
│  action = "run_opportunity_   │
│            agent"              │
└──────────────────────────────┘
```

### 4.2 Pipeline Agent (Evaluasi & Rekomendasi Deal)

**Tujuan:** Mengevaluasi setiap active deal, merekomendasikan stage
transition, update win probability, dan next best action.

**Model:** skylark-pro (reasoning kompleks)

**Trigger:** Celery Beat — setiap 1 jam (scan_pipeline)

```
Celery Beat (hourly) → run_pipeline_agent()
  │
  ▼
┌──────────────────────────────────────────┐
│  1. Fetch semua active opportunities       │
│  SELECT * FROM opportunities              │
│  JOIN stages WHERE is_closed = FALSE      │
└──────────────────┬───────────────────────┘
                   │
                   ▼  (untuk setiap opportunity)
┌──────────────────────────────────────────┐
│  2. Fetch activities untuk deal ini       │
│  SELECT * FROM activities                 │
│  WHERE opp_id = ? ORDER BY created_at     │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  3. Build context untuk LLM                │
│  { opp_name, current_value, current_stage,│
│    win_probability, close_date,           │
│    days_to_close, activity_count,         │
│    last_activity_days_ago,                │
│    activities_summary (last 10) }          │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  4. Evaluate Deal (skylark-pro)            │
│  Temperature: 0.4                          │
│                                            │
│  Prompt: "Analisis deal, berikan:         │
│    should_advance, target_stage,          │
│    reasoning, updated_win_probability,     │
│    next_best_action, risk_flags"           │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  5. Update win_probability                 │
│  UPDATE opportunities                      │
│  SET win_probability = ? WHERE id = ?     │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  6. Audit Log                              │
│  INSERT agent_logs                         │
│  agent_type = "pipeline"                   │
│  action = "evaluate_deal"                  │
└──────────────────────────────────────────┘
```

### 4.3 Insight Agent (Briefing & Anomali)

**Tujuan:** Generate daily briefing berupa narasi natural language,
insight menarik, dan alert/action items berdasarkan agregasi pipeline.

**Model:** skylark-pro

**Trigger:** Celery Beat — setiap 24 jam (daily_briefing)

```
Celery Beat (daily) → generate_daily_briefing()
  │
  ▼
┌──────────────────────────────────────────┐
│  1. Aggregate Metrics                      │
│                                            │
│  ├─ SUM(value * win_probability)           │
│  │  → total_weighted_pipeline             │
│  │                                         │
│  ├─ COUNT(id) WHERE is_closed=FALSE       │
│  │  → total_open_deals                     │
│  │                                         │
│  └─ AVG(win_probability)                   │
│     → avg_win_probability                  │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  2. Generate Briefing (skylark-pro)        │
│  Temperature: 0.5                          │
│                                            │
│  Prompt: "Buat daily briefing: summary,    │
│  insights, alerts, recommendation"         │
│                                            │
│  Output JSON:                              │
│  {                                         │
│    "summary": "ringkasan 2-3 kalimat",     │
│    "insights": ["insight 1", "..."],       │
│    "alerts": ["alert 1", "..."],           │
│    "recommendation": "rekomendasi utama"   │
│  }                                         │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  3. Audit Log                              │
│  INSERT agent_logs                         │
│  agent_type = "insight"                    │
│  action = "daily_briefing"                 │
│  input = metrics                           │
│  output = briefing                         │
└──────────────────────────────────────────┘
```

### 4.4 Model Tiering Strategy

| Tier | Model | Use Case | Temperature | Alasan |
|------|-------|----------|-------------|--------|
| Pro (reasoning) | `skylark-pro` | Stage transition evaluation, BANT scoring, daily briefing | 0.3–0.5 | Butuh kemampuan reasoning mendalam untuk analisis multi-faktor |
| Lite (fast) | `skylark-lite` | NER entity extraction, klasifikasi, summary | 0.2–0.3 | Tugas deterministik, butuh latency rendah & biaya murah |
| Embedding | `skylark-embedding-vision` | Vector embedding untuk semantic search | — | Generate 1024-dim vector untuk pgvector cosine similarity |

---

## 5. Tech Stack

### Backend

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Python | 3.11 | Bahasa pemrograman utama |
| FastAPI | 0.115.0 | Web framework async (ASGI) |
| Uvicorn | 0.30.0 | ASGI server (standalone / gunicorn worker) |
| Gunicorn | — | Process manager (4 workers, production) |
| SQLAlchemy | 2.0.35 (async) | ORM dengan async session support |
| asyncpg | 0.29.0 | PostgreSQL async driver |
| Pydantic | 2.9.0 | Data validation & serialization (v2) |
| pydantic-settings | 2.5.0 | Konfigurasi via environment variables |
| Celery | 5.4.0 | Distributed task queue (background agents) |
| Redis | 5.0.8 (Python client) | Celery broker + backend, cache |
| pgvector | 0.3.4 | Python binding untuk pgvector |
| openai | 1.51.0 | OpenAI-compatible client untuk BytePlus ModelArk |
| langgraph | 0.2.34 | Agent orchestration framework |
| python-jose | 3.3.0 | JWT encoding/decoding |
| passlib[bcrypt] | 1.7.4 | Password hashing |
| httpx | 0.27.0 | Async HTTP client |
| Alembic | 1.13.2 | Database migration |
| pytest | 8.3.3 | Testing framework |
| pytest-asyncio | 0.24.0 | Async test support |

### Frontend

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Next.js | 14.2.15 | React framework (App Router, SSR/CSR) |
| React | 18.3.1 | UI library |
| TypeScript | 5.6.3 | Type-safe JavaScript |
| Tailwind CSS | 3.4.13 | Utility-first CSS framework |
| Recharts | 2.12.7 | Chart library (dashboard analytics) |
| TanStack React Query | 5.59.0 | Server state management (data fetching) |
| Zustand | 4.5.5 | Client state management |
| lucide-react | 0.451.0 | Icon library |
| date-fns | 4.1.0 | Date utility |

### Infrastructure

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| PostgreSQL | 16 | Relational database |
| pgvector | — | Vector similarity search extension |
| Redis | 7 (alpine) | In-memory cache + message broker |
| Nginx | alpine | Reverse proxy, SSL, load balancer |
| Docker | — | Containerization |
| Docker Compose | — | Multi-container orchestration |
| BytePlus ModelArk | — | External LLM API (skylark models) |

---

## 6. Design Decisions

### 6.1 Why Async SQLAlchemy?

**Keputusan:** Menggunakan SQLAlchemy 2.0 dengan async session (`async_sessionmaker`)
dan driver `asyncpg`.

**Alasan:**
- **High concurrency:** FastAPI adalah framework async. Dengan async DB driver,
  satu worker dapat menangani ribuan koneksi concurrent tanpa blocking thread.
- **Non-blocking I/O untuk LLM calls:** Setiap request AI Agent melibatkan
  panggilan ke BytePlus ModelArk yang bisa memakan 2–10 detik. Dengan async,
  selama menunggu LLM response, event loop dapat melayani request lain.
- **Connection pooling:** `asyncpg` memiliki connection pool native yang
  efisien untuk PostgreSQL.
- **Celery compatibility:** Celery worker menggunakan `_run_async()` yang
  membuat event loop baru dengan `NullPool` untuk menghindari connection leak
  antar task.

### 6.2 Why pgvector?

**Keputusan:** Menggunakan extension `pgvector` di PostgreSQL 16 dengan
kolom `embedding vector(1024)` dan index `ivfflat` (`vector_cosine_ops`,
`lists=100`).

**Alasan:**
- **Semantic search untuk opportunities:** Mencari deal mirip berdasarkan
  makna, bukan keyword exact match. Fungsi `tool_search_similar_deals()`
  menggunakan `cosine_distance` untuk mencari opportunity paling relevan.
- **Unified database:** Tidak perlu database vektor terpisah (Pinecone,
  Weaviate). Semua data — relational + vector — di satu PostgreSQL instance.
- **Cosine similarity:** Index `ivfflat` dengan `vector_cosine_ops` memberikan
  approximate nearest neighbor (ANN) search yang cepat untuk dataset skala
  menengah.
- **lists=100:** Parameter ini menyesuaikan jumlah cluster untuk ANN.
  Optimal untuk ribuan hingga puluhan ribu vektor.
- **Operational simplicity:** Backup, monitoring, dan recovery vector data
  menggunakan tooling PostgreSQL yang sudah ada.

### 6.3 Why Celery?

**Keputusan:** Menggunakan Celery 5.4 dengan Redis sebagai broker dan backend,
plus Celery Beat untuk scheduling.

**Alasan:**
- **Background pipeline scan (hourly):** Pipeline Agent perlu mengevaluasi
  semua active deals setiap jam. Ini adalah task berat (multiple LLM calls)
  yang tidak boleh memblokir API.
- **Daily briefing:** Insight Agent generate briefing setiap 24 jam.
  Dijadwalkan via `beat_schedule`.
- **Decoupling:** Task berat (LLM calls, batch processing) dipisahkan dari
  request-response cycle. API tetap responsif.
- **Reliability:** Celery menyediakan retry mechanism, task tracking, dan
  result backend. Jika task gagal, bisa di-retry.
- **Timezone-aware:** `beat_schedule` menggunakan `timezone="Asia/Jakarta"`
  dan `enable_utc=True` untuk scheduling yang akurat.

**Schedule:**

| Task | Schedule | Fungsi |
|------|----------|--------|
| `tasks.scan_pipeline` | 3600 detik (1 jam) | Pipeline Agent evaluasi semua active deals |
| `tasks.daily_briefing` | 86400 detik (24 jam) | Insight Agent generate daily briefing |

### 6.4 Why Gunicorn with Uvicorn Workers?

**Keputusan:** Production menggunakan
`gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000`.

**Alasan:**
- **Multi-process + async:** Gunicorn menangani process management (4 worker
  processes), sementara setiap worker menggunakan Uvicorn (ASGI) untuk async
  event loop. Kombinasi terbaik dari kedua dunia.
- **Horizontal scaling per-node:** 4 worker processes memungkinkan utilisasi
  multi-core CPU. Setiap worker memiliki event loop independen.
- **Graceful reload:** Gunicorn mendukung hot reload tanpa downtime
  (`SIGHUP` untuk reload workers).
- **Process isolation:** Jika satu worker crash (OOM, unhandled exception),
  worker lain tetap berjalan. Gunicorn akan spawn worker baru otomatis.
- **Development mode:** Di development, cukup
  `uvicorn app.main:app --reload` (single process, auto-reload).

### 6.5 Why Nginx?

**Keputusan:** Nginx (alpine) sebagai reverse proxy di depan frontend dan
backend, menangani port 80 (redirect ke 443) dan 443 (SSL).

**Alasan:**
- **SSL termination:** Sertifikat TLS dikelola di Nginx (`/etc/nginx/certs/`),
  mendukung TLSv1.2 dan TLSv1.3. Backend dan frontend tidak perlu mengurus SSL.
- **Security headers:** Nginx menambahkan header keamanan:
  - `X-Frame-Options: DENY` (anti clickjacking)
  - `X-Content-Type-Options: nosniff` (anti MIME sniffing)
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Permitted-Cross-Domain-Policies: none`
- **Gzip compression:** Kompresi response untuk `text/plain`, `text/css`,
  `application/json`, `application/javascript` (min 256 bytes).
- **Routing:** Single entry point — `/api/*` ke backend, `/` ke frontend,
  `/docs` dan `/health` ke backend.
- **WebSocket support:** Konfigurasi `Upgrade` dan `Connection: upgrade`
  untuk Next.js HMR di development.
- **Timeout control:** `proxy_read_timeout 120s` untuk request AI Agent
  yang melibatkan LLM calls yang panjang.

### 6.6 Model Tiering: skylark-pro vs skylark-lite

**Keputusan:** Menggunakan dua tier model LLM dari BytePlus ModelArk.

| Aspek | skylark-pro | skylark-lite |
|-------|-------------|--------------|
| **Kemampuan** | Reasoning kompleks, multi-step analysis | NER, klasifikasi, summary sederhana |
| **Latency** | Lebih tinggi (2–10 detik) | Lebih rendah (<2 detik) |
| **Biaya** | Lebih mahal per token | Lebih murah per token |
| **Temperature** | 0.3–0.5 (kreatif tapi terkontrol) | 0.2–0.3 (deterministik) |
| **Use Case** | BANT scoring, stage transition eval, daily briefing | Entity extraction dari raw text |

**Alasan tiering:**
- **Cost optimization:** Tugas sederhana (NER) tidak butuh model mahal.
  skylark-lite cukup dan jauh lebih murah.
- **Latency:** User-facing operations (seperti entity extraction saat input
  lead baru) butuh response cepat. skylark-lite memberikan latency rendah.
- **Quality:** Tugas yang butuh reasoning mendalam (evaluasi BANT, rekomendasi
  stage transition) memerlukan kemampuan analitis skylark-pro.
- **Embedding:** Terpisah dari tier chat, menggunakan
  `skylark-embedding-vision` untuk generate vector 1024-dim.

---

## 7. Security Architecture

### 7.1 Authentication & Authorization

| Komponen | Implementasi |
|----------|-------------|
| **JWT Auth** | Token-based authentication menggunakan `python-jose` (HS256), expiry 1440 menit (24 jam) |
| **Password Hashing** | `passlib[bcrypt]` untuk hashing password user |
| **User Roles** | Tabel `users` dengan kolom `role` (default: `sales_rep`), mendukung RBAC |
| **JWT Secret** | Disimpan di environment variable `JWT_SECRET`, tidak hardcoded |

### 7.2 Secrets Management

| Prinsip | Implementasi |
|---------|-------------|
| **No secrets in code** | Semua kredensial via environment variables (`.env`, Docker env) |
| **Environment variables** | `ARK_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL` |
| **`.env.example`** | Template environment variables tanpa nilai rahasia |
| **Docker env injection** | `${ARK_API_KEY}` — nilai dari host environment, tidak di image |

### 7.3 Network Security

| Lapisan | Implementasi |
|---------|-------------|
| **TLS/SSL** | Nginx termination dengan TLSv1.2/TLSv1.3, `ssl_ciphers HIGH:!aNULL` |
| **CORS** | FastAPI CORS middleware, `allow_origins=["http://localhost:3000"]` |
| **HTTP → HTTPS redirect** | Nginx port 80 melakukan `301 redirect` ke HTTPS |
| **Internal network** | Container komunikasi via Docker network, tidak exposed ke host (kecuali perlu) |

### 7.4 Docker Isolation

| Aspek | Implementasi |
|-------|-------------|
| **Container per service** | Setiap service (postgres, redis, backend, celery, frontend, nginx) berjalan di container terpisah |
| **Volume isolation** | Data persisten di Docker named volumes (`postgres_data`, `redis_data`) |
| **Health checks** | PostgreSQL (`pg_isready`), Redis (`redis-cli ping`) — dependensi conditional |
| **Least privilege** | Container hanya expose port yang diperlukan |
| **Restart policy** | `restart: unless-stopped` di production untuk auto-recovery |

### 7.5 Data Security

| Aspek | Implementasi |
|-------|-------------|
| **CASCADE delete** | `contacts`, `activities`, `tasks` menggunakan `ON DELETE CASCADE` dari parent |
| **Audit trail** | Tabel `agent_logs` mencatat setiap aksi AI Agent (input, output, token usage, status) |
| **Input validation** | Pydantic v2 schema validation di setiap API endpoint |
| **SQL injection prevention** | SQLAlchemy ORM dengan parameterized queries |

---

## 8. Scalability Notes

### 8.1 Horizontal Scaling — Backend

```
                    ┌─────────────┐
                    │   Nginx     │
                    │ (Load Bal.) │
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Backend  │ │ Backend  │ │ Backend  │
        │ Node 1   │ │ Node 2   │ │ Node N   │
        │ :8000    │ │ :8000    │ │ :8000    │
        │ gunicorn │ │ gunicorn │ │ gunicorn │
        │ 4 workers│ │ 4 workers│ │ 4 workers│
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             └─────────────┼────────────┘
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    │  + Read     │
                    │  Replicas   │
                    └─────────────┘
```

- **Stateless backend:** FastAPI tidak menyimpan session state di memory.
  Setiap request independen → bisa scale horizontally dengan menambah node.
- **gunicorn 4 workers per node:** 4 worker processes × N nodes = 4N concurrent
  async event loops.
- **Nginx load balancing:** Tambah upstream server di `nginx.conf`:
  ```
  upstream backend_upstream {
      server backend1:8000;
      server backend2:8000;
      server backendN:8000;
  }
  ```

### 8.2 Database Scaling — Read Replicas

| Strategi | Implementasi |
|----------|-------------|
| **Read replicas** | Direct read-heavy queries (dashboard, analytics) ke replica; write ke primary |
| **Connection pooling** | `asyncpg` pool + `pgbouncer` (opsional) untuk multiplexing koneksi |
| **Materialized views** | `mv_funnel_summary`, `mv_forecast_data`, `mv_rep_performance` — pre-aggregated untuk beban read berat. Refresh secara periodik. |
| **Indexing strategy** | Index pada `stage_id`, `owner_id`, `close_date`, `embedding` (ivfflat), `opp_id`, `agent_logs(agent_type, timestamp)` |

### 8.3 Celery Worker Scaling

```
┌──────────────┐
│ Celery Beat   │  (scheduler, single instance)
└──────┬───────┘
       ▼
┌──────────────┐
│    Redis      │  (broker)
└──────┬───────┘
       │
  ┌────┼────────┐
  ▼    ▼        ▼
┌────┐┌────┐  ┌────┐
│ W1 ││ W2 │  │ WN │  (worker instances, scale horizontally)
│c=2 ││c=2 │  │c=2 │  (concurrency=2 per worker)
└────┘└────┘  └────┘
```

- **Horizontal scaling:** Tambah Celery worker container untuk memproses
  lebih banyak task secara paralel.
- **Concurrency:** Production menggunakan `--concurrency=2` per worker
  (karena setiap task melibatkan async LLM calls yang I/O-bound).
- **NullPool:** Setiap Celery task membuat engine baru dengan `NullPool`
  untuk mencegah connection leak antar task.

### 8.4 Caching Strategy

| Data | Cache Layer | TTL |
|------|-------------|-----|
| Dashboard metrics | Redis | 5–15 menit |
| Stage list | Redis / in-memory | 1 jam (jarang berubah) |
| LLM responses (idempotent) | Redis (opsional) | 1 jam |
| Materialized views | PostgreSQL | Refresh hourly/daily |

### 8.5 LLM API Scaling Considerations

| Pertimbangan | Mitigasi |
|-------------|----------|
| **Rate limiting** (BytePlus ModelArk) | Celery queue men-throttle request; background tasks tidak membebani API realtime |
| **Latency** (2–10 detik per LLM call) | Async I/O → tidak blocking; background untuk batch processing |
| **Cost** | Model tiering (lite untuk tugas sederhana, pro untuk reasoning) |
| **Token usage tracking** | `agent_logs.token_usage` mencatat konsumsi token per aksi |

---

## Lampiran: Struktur Direktori

```
renrnd-sales-agentic/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── opportunity_agent.py      # NER + BANT scoring
│   │   │   ├── pipeline_agent.py         # Stage evaluation
│   │   │   ├── insight_agent.py          # Daily briefing
│   │   │   ├── tools/
│   │   │   │   └── opportunity_tools.py  # Function calling tools
│   │   │   └── prompts/
│   │   ├── api/v1/
│   │   │   ├── accounts.py
│   │   │   ├── activities.py
│   │   │   ├── agents.py                  # AI agent endpoints
│   │   │   ├── dashboard.py
│   │   │   ├── opportunities.py
│   │   │   ├── stages.py
│   │   │   └── tasks.py
│   │   ├── db/
│   │   │   ├── database.py                # Async engine + session
│   │   │   ├── init.sql                   # Schema + seed
│   │   │   └── seed.py
│   │   ├── models/                        # SQLAlchemy models
│   │   ├── schemas/                       # Pydantic v2 schemas
│   │   ├── services/
│   │   ├── config.py                      # Settings (env vars)
│   │   ├── llm_client.py                  # BytePlus ModelArk client
│   │   ├── celery_app.py                  # Background tasks
│   │   └── main.py                        # FastAPI app entry point
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                           # Next.js App Router pages
│   │   ├── components/
│   │   ├── lib/api.ts                     # API client
│   │   └── types/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf                         # Reverse proxy config
│   └── certs/                             # SSL certificates
├── docker-compose.yml                     # Development
├── docker-compose.prod.yml                # Production
└── .env.example                           # Environment template
```

---

*Dokumen ini bersifat living document dan akan diperbarui seiring
evolusi arsitektur sistem.*
