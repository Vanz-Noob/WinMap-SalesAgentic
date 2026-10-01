# Rencana Aplikasi Agentic AI for Sales

> **Nama Proyek:** RenRND Sales Agentic AI  
> **Versi Dokumen:** 2.0  
> **Tanggal:** 22 September 2026  
> **Penulis:** Tim RnD Vanza  

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Identifikasi Masalah & Tujuan](#2-identifikasi-masalah--tujuan)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Tech Stack](#4-tech-stack)
5. [Fitur Utama](#5-fitur-utama)
6. [Komponen Agentic AI](#6-komponen-agentic-ai)
7. [Model Data](#7-model-data)
8. [Spesifikasi Dashboard (Tableau)](#8-spesifikasi-dashboard-tableau)
9. [Roadmap Implementasi](#9-roadmap-implementasi)
10. [Struktur Folder Proyek](#10-struktur-folder-proyek)
11. [Estimasi Timeline & Milestone](#11-estimasi-timeline--milestone)
12. [Risiko & Mitigasi](#12-risiko--mitigasi)
13. [Panduan Langkah-demi-Langkah: Dari Instalasi hingga Selesai](#13-panduan-langkah-demi-langkah-dari-instalasi-hingga-selesai)

---

## 1. Ringkasan Eksekutif

Aplikasi **RenRND Sales Agentic AI** adalah platform berbasis AI agen yang mengotomatisasi seluruh siklus penjualan — mulai dari pembuatan **opportunities**, pengelolaan **sales pipeline**, hingga visualisasi performa bisnis melalui **dashboard interaktif** (mirip Tableau / Power BI).

Aplikasi ini menggunakan AI agen untuk:
- **Mendeteksi & membuat opportunities** secara otomatis dari berbagai sumber data (email, meeting notes, CRM eksternal, lead inbound).
- **Mengelola pipeline** dengan memindahkan deal antar tahap, memberikan rekomendasi next-best-action, dan memperkirakan probabilitas closing.
- **Menghasilkan dashboard** real-time yang menampilkan progress bisnis, funnel analysis, revenue forecast, dan KPI sales.

**Tableau** digunakan sebagai engine visualisasi untuk dashboard analitik tingkat lanjut.

---

## 2. Identifikasi Masalah & Tujuan

### 2.1 Masalah yang Dipecahkan

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Pembuatan opportunities manual dan rentan terlewat | Potensi revenue hilang |
| 2 | Pipeline tidak ter-update secara real-time | Visibility rendah |
| 3 | Tidak ada prediksi closing deal | Forecast tidak akurat |
| 4 | Dashboard reporting dibuat manual, lambat | Decision making tertunda |
| 5 | Sales rep fokus ke admin daripada selling | Produktivitas turun |

### 2.2 Tujuan (OKR)

- **Objective 1:** Mengotomatisasi 80% tugas administratif sales (opportunity creation & pipeline update).
  - **KR1:** AI agen membuat ≥100 opportunities/bulan secara otomatis.
  - **KR2:** Pipeline update latency <5 menit setelah trigger.

- **Objective 2:** Menyediakan dashboard real-time untuk visibility bisnis.
  - **KR1:** Dashboard refresh <1 menit.
  - **KR2:** 5+ view analitik (funnel, forecast, rep performance, dll).

- **Objective 3:** Meningkatkan akurasi forecast.
  - **KR1:** Forecast accuracy ≥85%.
  - **KR2:** Win-rate prediction dengan confidence ≥80%.

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                      LAYER: USER INTERFACE                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │ Web App  │  │ Mobile   │  │ Tableau Dashboard         │  │
│  │ (React)  │  │ (PWA)    │  │ (Embedded via Tableau JS) │  │
│  └────┬─────┘  └────┬─────┘  └───────────┬───────────────┘  │
└───────┼──────────────┼────────────────────┼──────────────────┘
        │              │                    │
┌───────▼──────────────▼────────────────────▼──────────────────┐
│                    LAYER: API GATEWAY                         │
│                  (FastAPI / Python)                           │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Oppor-   │ │ Pipeline   │ │ Dashboard│ │ Agent        │  │
│  │ tunity   │ │ Service   │ │ Service  │ │ Orchestrator │  │
│  │ API      │ │ API       │ │ API      │ │ API          │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘  │
└───────┬──────────────┬────────────────────┬──────────────────┘
        │              │                    │
┌───────▼──────────────▼────────────────────▼──────────────────┐
│                  LAYER: AGENTIC AI CORE                       │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Oppor-     │ │ Pipeline     │ │ Insight & Forecast     │ │
│  │ tunity     │ │ Agent        │ │ Agent                   │ │
│  │ Agent      │ │              │ │                         │ │
│  ├────────────┤ ├──────────────┤ ├────────────────────────┤ │
│  │ - Lead     │ │ - Stage     │ │ - Revenue forecast     │ │
│  │   scoring  │ │   transition│ │ - Win probability      │ │
│  │ - Auto     │ │ - Next best │ │   prediction           │ │
│  │   create   │ │   action    │ │ - Anomaly detection    │ │
│  │ - Enrich   │ │ - Risk      │ │ - Sentiment analysis   │ │
│  │   data     │ │   alert     │ │   (deal health)        │ │
│  └────────────┘ └──────────────┘ └────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │      LLM Engine (BytePlus ModelArk / Skylark)            │ │
│  │  + Tool Calling + RAG (Skylark Embedding + pgvector)     │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────┬──────────────┬────────────────────┬──────────────────┘
        │              │                    │
┌───────▼──────────────▼────────────────────▼──────────────────┐
│                  LAYER: DATA & STORAGE                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │ PostgreS │ │ Redis    │ │ pgvector │ │ Tableau         │ │
│  │ (main DB)│ │ (cache/  │ │ (vector  │ │ Hyper           │ │
│  │          │ │  queue)  │ │ storage) │ │ (dashboard      │ │
│  │          │ │          │ │          │ │  data source)   │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack

### 4.1 Backend & AI

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| **API Server** | Python + FastAPI | Async, cepat, ekosistem AI/ML matang |
| **AI/LLM Engine** | **BytePlus ModelArk** (Skylark) | OpenAI-compatible API, tool calling, token plan fleksibel, region Asia Tenggara |
| **LLM Models** | Skylark-pro (reasoning) & Skylark-lite (simple tasks) | Model tiering untuk efisiensi biaya token |
| **Embedding Model** | **Skylark Embedding** (`skylark-embedding-vision`) | Text + multimodal embedding via BytePlus ModelArk API |
| **Agent Framework** | LangGraph / CrewAI | Multi-agent orchestration, state management |
| **Vector Storage** | pgvector (PostgreSQL extension) | Satu DB untuk relational + vector, hemat infra |
| **Task Queue** | Celery + Redis | Background job untuk agent async processing |
| **Database** | PostgreSQL 16 | Reliabel, ACID, mendukung pgvector & JSONB |
| **Cache** | Redis | Session state, rate limiting, pub/sub |

#### 4.1.1 Detail Konfigurasi BytePlus ModelArk

| Parameter | Nilai |
|-----------|-------|
| **API Base URL** | `https://ark.ap-southeast.bytepluses.com/api/v3` |
| **Auth Method** | Bearer Token (`ARK_API_KEY`) |
| **API Compatibility** | OpenAI SDK compatible (drop-in replacement) |
| **LLM (Reasoning)** | `skylark-pro` — Input $0.40/M, Output $1.60/M tokens |
| **LLM (Simple Tasks)** | `skylark-lite` — Input $0.10/M, Output $0.40/M tokens |
| **Embedding** | `skylark-embedding-vision` — Text $0.125/M tokens, Image $0.325/M tokens |
| **Free Quota (Embedding)** | 500K tokens |
| **Context Caching** | Didukung (menghemat biaya input token berulang) |

> **Catatan Biaya:** Dengan model tiering (Skylark-pro untuk reasoning kompleks, Skylark-lite untuk tugas sederhana seperti NER/classification), estimasi biaya LLM dapat ditekan hingga 60% dibanding menggunakan single model pro untuk semua task.

### 4.2 Frontend

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| **Web UI** | Next.js 14 (App Router) + TypeScript | SSR, SEO, ecosystem matang |
| **UI Components** | shadcn/ui + Tailwind CSS | Cepat, konsisten, accessible |
| **State Management** | Zustand + TanStack Query | Lightweight, cache-friendly |
| **Real-time** | WebSocket (Socket.io) | Live pipeline update & notifications |
| **Charts (in-app)** | Recharts / Apache ECharts | Lightweight in-app visualization |

### 4.3 Dashboard & BI

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| **Dashboard Engine** | **Tableau Server / Tableau Cloud** | Profesional, interactive, enterprise-grade |
| **Embedding** | Tableau JavaScript API | Embed dashboard ke dalam web app |
| **Data Connector** | Tableau PostgreSQL Connector | Direct connection ke main DB |
| **Refresh Strategy** | Tableau Live Connection / Extract (15 min) | Real-time atau near real-time |
| **Alternatif (opsional)** | Apache Superset | Open-source, self-hosted, gratis |

### 4.4 DevOps & Infrastruktur

| Komponen | Teknologi |
|----------|-----------|
| **Containerization** | Docker + Docker Compose |
| **Orchestration** | Kubernetes (opsional, untuk scale) |
| **CI/CD** | GitHub Actions |
| **Monitoring** | Grafana + Prometheus |
| **Logging** | Loki + Promtail |
| **Secret Management** | HashiCorp Vault / .env vault |

---

## 5. Fitur Utama

### 5.1 Modul: Opportunities (AI-Powered)

| Fitur | Deskripsi |
|-------|-----------|
| **Auto Discovery** | AI agen memindai email, meeting transcript, dan lead inbound untuk mendeteksi potensi opportunity |
| **Lead Scoring** | Skor lead berdasarkan BANT (Budget, Authority, Need, Timeline) menggunakan ML model |
| **Auto Enrichment** | Melengkapi data opportunity (company info, tech stack, competitor intel) dari sumber eksternal |
| **Smart Qualification** | AI mengevaluasi apakah lead layak menjadi opportunity berdasarkan historikal data |
| **Auto Create** | Membuat record opportunity di database dengan data terstruktur secara otomatis |
| **Duplicate Detection** | Mencegah opportunity ganda menggunakan fuzzy matching |

### 5.2 Modul: Pipeline Management (AI-Powered)

| Fitur | Deskripsi |
|-------|-----------|
| **Kanban Board** | Drag-and-drop pipeline dengan tahapan kustomizable |
| **Stage Transition AI** | AI merekomendasikan / otomatis memindahkan deal ke tahap berikutnya |
| **Next Best Action** | AI memberikan saran tindakan spesifik (call, email, demo, follow-up) |
| **Win Probability** | Real-time scoring probabilitas closing berdasarkan deal characteristics |
| **Risk Detection** | AI mendeteksi deal yang stagnan atau berisiko (no activity, negative sentiment) |
| **Forecast AI** | Revenue forecast berbasis AI dengan confidence interval |
| **Pipeline Analytics** | Conversion rate per stage, velocity, aging analysis |

### 5.3 Modul: Dashboard (Tableau-Powered)

| Dashboard | Metrics Utama |
|-----------|---------------|
| **Sales Funnel** | Jumlah deal per stage, conversion rate, drop-off analysis |
| **Revenue Forecast** | Predicted vs actual revenue, confidence band, quota attainment |
| **Rep Performance** | Win rate, avg deal size, sales cycle length, activity volume |
| **Pipeline Health** | Pipeline coverage ratio, aging deals, at-risk opportunities |
| **Trend Analysis** | MoM/QoQ growth, seasonality, cohort analysis |
| **Geographic View** | Revenue by region/city, market penetration map |
| **Activity Intelligence** | Calls, meetings, emails → correlation dengan win rate |

---

## 6. Komponen Agentic AI

### 6.1 Arsitektur Multi-Agent

```
                    ┌─────────────────┐
                    │  Orchestrator   │
                    │  Agent          │
                    │  (Router/Coord) │
                    └───────┬─────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
   ┌────────▼──────┐ ┌─────▼───────┐ ┌────▼──────────┐
   │ Opportunity   │ │ Pipeline    │ │ Insight       │
   │ Agent          │ │ Agent       │ │ Agent         │
   │                │ │             │ │               │
   │ Tools:         │ │ Tools:      │ │ Tools:        │
   │ - search_leads │ │ - move_stage│ │ - query_db    │
   │ - enrich_data  │ │ - log_activ │ │ - calc_metrics│
   │ - score_lead   │ │ - set_task  │ │ - generate_rpt│
   │ - create_opp   │ │ - send_email│ │ - detect_anom │
   └────────────────┘ └─────────────┘ └───────────────┘
```

### 6.2 Detail Per Agent

#### Agent 1: Opportunity Agent
- **Trigger:** Inbound lead, email parsing, meeting transcript upload
- **Workflow:**
  1. Ingest raw data dari sumber
  2. NER (Named Entity Recognition) untuk ekstrak company, contact, need
  3. Enrich dengan data eksternal (LinkedIn, company website)
  4. Score dengan BANT framework
  5. Jika score > threshold → buat opportunity record
  6. Notifikasi sales rep via UI + email
- **LLM Role:** NER extraction, intent classification, summarization

#### Agent 2: Pipeline Agent
- **Trigger:** Schedule (hourly), activity log, stage change event
- **Workflow:**
  1. Scan semua active opportunities
  2. Evaluasi stage appropriateness (apakah deal siap maju?)
  3. Hitung win probability update
  4. Generate next best action per deal
  5. Deteksi stagnant deals (no activity >7 hari)
  6. Auto-log activity ke CRM record
- **LLM Role:** Reasoning untuk stage transition, action recommendation

#### Agent 3: Insight Agent
- **Trigger:** Schedule (daily), user query (on-demand), dashboard load
- **Workflow:**
  1. Agregasi data pipeline
  2. Hitung metrik (conversion rate, velocity, forecast)
  3. Deteksi anomali (deal drop, revenue shortfall)
  4. Generate narasi insight natural language
  5. Push data ke Tableau data source
  6. Kirim daily/weekly briefing ke sales manager
- **LLM Role:** Insight generation, narrative reporting, Q&A natural language

### 6.3 Tool Registry (Function Calling)

```python
TOOLS = {
    # Opportunity Tools
    "search_leads": "Cari leads di database berdasarkan kriteria",
    "enrich_company": "Enrich data perusahaan dari sumber eksternal",
    "score_lead_bant": "Score lead berdasarkan BANT framework",
    "create_opportunity": "Buat record opportunity baru di database",

    # Pipeline Tools
    "move_pipeline_stage": "Pindahkan deal ke stage berbeda",
    "log_activity": "Catat aktivitas sales (call, email, meeting)",
    "create_task": "Buat task follow-up untuk sales rep",
    "send_email_template": "Kirim email menggunakan template",

    # Insight Tools
    "query_pipeline_data": "Query data pipeline dengan SQL",
    "calculate_forecast": "Hitung revenue forecast dengan ML",
    "detect_anomalies": "Deteksi anomali dalam pipeline",
    "generate_tableau_data": "Push data terstruktur ke Tableau source",
}
```

---

## 7. Model Data

### 7.1 Entity Relationship (Simplified)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Account     │     │   Opportunity    │     │   Activity   │
│──────────────│     │──────────────────│     │──────────────│
│ id (PK)      │◄──┐ │ id (PK)          │ ┌──►│ id (PK)      │
│ name         │   └─│ account_id (FK)  │ │   │ opp_id (FK)  │
│ industry     │     │ name             │ │   │ type         │
│ website      │     │ stage            │ │   │ description  │
│ size         │     │ value            │ │   │ timestamp    │
│ created_at   │     │ close_date       │ │   │ created_by   │
└──────────────┘     │ win_probability  │ │   └──────────────┘
                     │ owner_id (FK)    │ │
┌──────────────┐     │ source           │ │     ┌──────────────┐
│   Contact     │     │ created_at       │ │     │   Task        │
│──────────────│     │ updated_at       │ │     │──────────────│
│ id (PK)      │◄──┐ │ ai_metadata      │ │  ┌─►│ id (PK)      │
│ account_id   │   │ └──────────────────┘ │  │  │ opp_id (FK)  │
│ name         │   │                      │  │  │ title        │
│ email        │   │  ┌──────────────────┐│  │  │ due_date     │
│ phone        │   └──│ Contact (M:N)    ││  │  │ status       │
│ role         │      │ via junction table││  │  │ assigned_to  │
└──────────────┘      └──────────────────┘│  │  └──────────────┘
                                           │  │
                     ┌──────────────────┐ │  │
                     │   Stage          │ │  │
                     │──────────────────│ │  │
                     │ id (PK)          │ │  │
                     │ name             │ │  │
                     │ order            │ │  │
                     │ probability      │ │  │
                     └──────────────────┘ │  │
                                         │  │
                     ┌──────────────────┐ │  │
                     │ Agent_Log       │◄┘  │
                     │──────────────────│    │
                     │ id (PK)          │◄───┘
                     │ agent_type       │
                     │ action           │
                     │ input            │
                     │ output           │
                     │ timestamp        │
                     └──────────────────┘
```

### 7.2 Skema Tabel Utama

#### Table: `opportunities`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | Unique identifier |
| account_id | UUID (FK) | Relasi ke accounts |
| name | VARCHAR(255) | Nama opportunity |
| stage_id | UUID (FK) | Stage pipeline saat ini |
| value | DECIMAL(15,2) | Nilai deal (IDR/USD) |
| currency | VARCHAR(3) | IDR / USD |
| close_date | DATE | Estimasi tanggal closing |
| win_probability | FLOAT | 0.0 - 1.0, dihitung AI |
| owner_id | UUID (FK) | Sales rep pemilik deal |
| source | VARCHAR(50) | Sumber lead (inbound, referral, dll) |
| ai_metadata | JSONB | Data tambahan dari AI agent |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### Table: `agent_logs`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | UUID (PK) | |
| agent_type | VARCHAR(50) | opportunity / pipeline / insight |
| action | VARCHAR(100) | Nama tool yang dipanggil |
| input | JSONB | Parameter input |
| output | JSONB | Hasil eksekusi |
| token_usage | INT | Token LLM yang digunakan |
| status | VARCHAR(20) | success / failed |
| timestamp | TIMESTAMP | |

---

## 8. Spesifikasi Dashboard (Tableau)

### 8.1 Arsitektur Dashboard

```
┌──────────────────────────────────────────┐
│         Web App (Next.js)                │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │   Dashboard Page                   │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │  Tableau Embedded Dashboard  │  │ │
│  │  │  (via Tableau JS API v3)     │  │ │
│  │  │                              │  │ │
│  │  │  - Filter by date/rep/region │  │ │
│  │  │  - Drill-down capability     │  │ │
│  │  │  - Export to PDF/Excel       │  │ │
│  │  │  - Row-level security        │  │ │
│  │  └──────────────────────────────┘  │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
              │
              │ REST API / Live Connection
              ▼
┌──────────────────────────────────────────┐
│       Tableau Server / Cloud             │
│                                         │
│  Workbook 1: Sales Funnel Dashboard     │
│  Workbook 2: Revenue Forecast           │
│  Workbook 3: Rep Performance             │
│  Workbook 4: Pipeline Health            │
└──────────────────────────────────────────┘
              │
              │ SQL Query
              ▼
┌──────────────────────────────────────────┐
│    PostgreSQL (Main Database)            │
│  + Materialized Views untuk agregasi     │
└──────────────────────────────────────────┘
```

### 8.2 Detail Workbook Tableau

#### Workbook 1: Sales Funnel Dashboard
| Sheet | Visualization | Metrics |
|-------|---------------|---------|
| Funnel Chart | Funnel | Jumlah deal & nilai per stage |
| Conversion Rate | Bar Chart | % conversion antar stage |
| Stage Duration | Box Plot | Waktu rata-rata per stage |
| Drop-off Analysis | Line Chart | Trend drop-off per bulan |

#### Workbook 2: Revenue Forecast
| Sheet | Visualization | Metrics |
|-------|---------------|---------|
| Forecast Line | Line + Band | Predicted revenue + confidence interval |
| Quota Attainment | Gauge / Bullet | Actual vs quota per rep |
| Deal Pipeline | Stacked Bar | Weighted pipeline by close month |
| Win/Loss Analysis | Pie / Donut | Win rate overall & by segment |

#### Workbook 3: Rep Performance
| Sheet | Visualization | Metrics |
|-------|---------------|---------|
| Leaderboard | Table | Rank by revenue, win rate, activity |
| Activity vs Win | Scatter Plot | Korelasi aktivitas dengan win rate |
| Sales Cycle | Histogram | Distribusi panjang sales cycle |
| Deal Velocity | Line Chart | Trend velocity per rep |

#### Workbook 4: Pipeline Health
| Sheet | Visualization | Metrics |
|-------|---------------|---------|
| Pipeline Coverage | KPI Card | Ratio: pipeline value / quota |
| Aging Deals | Heatmap | Deal aging by stage |
| At-Risk Deals | Table | Deal dengan win_prob <30% atau no activity |
| AI Alerts | Table | Insight dari Insight Agent |

### 8.3 Materialized Views untuk Tableau

```sql
-- View: v_funnel_summary
CREATE MATERIALIZED VIEW v_funnel_summary AS
SELECT
    s.name AS stage_name,
    s.order AS stage_order,
    COUNT(o.id) AS deal_count,
    SUM(o.value) AS total_value,
    AVG(o.win_probability) AS avg_win_prob,
    DATE_TRUNC('month', o.created_at) AS month
FROM opportunities o
JOIN stages s ON o.stage_id = s.id
GROUP BY s.name, s.order, DATE_TRUNC('month', o.created_at);

-- View: v_forecast_data
CREATE MATERIALIZED VIEW v_forecast_data AS
SELECT
    DATE_TRUNC('month', o.close_date) AS close_month,
    SUM(o.value * o.win_probability) AS weighted_pipeline,
    SUM(o.value) AS unweighted_pipeline,
    COUNT(o.id) AS deal_count,
    AVG(o.win_probability) AS avg_probability
FROM opportunities o
WHERE o.stage_id NOT IN (SELECT id FROM stages WHERE name IN ('Closed Won', 'Closed Lost'))
GROUP BY DATE_TRUNC('month', o.close_date)
ORDER BY close_month;

-- Refresh strategy: setiap 15 menit
-- (atau trigger dari agent setelah pipeline update)
```

---

## 9. Roadmap Implementasi

### Phase 0: Setup & Foundation (Minggu 1-2)
- [ ] Inisialisasi monorepo / workspace
- [ ] Setup Docker Compose (PostgreSQL + Redis + pgvector)
- [ ] Setup CI/CD pipeline (GitHub Actions)
- [ ] Buat database schema & migration
- [ ] Setup FastAPI project structure
- [ ] Setup Next.js project structure
- [ ] **Daftar & aktivasi BytePlus ModelArk account**
- [ ] **Dapatkan `ARK_API_KEY` & aktivasi model Skylark-pro, Skylark-lite, skylark-embedding-vision**
- [ ] **Test koneksi API BytePlus (chat completions + embeddings)**

### Phase 1: Core Backend & Data Model (Minggu 3-5)
- [ ] Implementasi CRUD Opportunities API
- [ ] Implementasi CRUD Pipeline & Stages API
- [ ] Implementasi Activity logging API
- [ ] Implementasi Task management API
- [ ] Setup authentication & authorization (JWT)
- [ ] Buat materialized views untuk dashboard
- [ ] Seed data dummy untuk testing

### Phase 2: Agentic AI Core (Minggu 6-9)
- [ ] Setup LangGraph agent orchestration
- [ ] **Integrasi BytePlus ModelArk SDK (OpenAI-compatible) sebagai LLM backend**
- [ ] **Setup Skylark Embedding untuk RAG (simpan vector di pgvector)**
- [ ] Implementasi Opportunity Agent
  - [ ] Email parsing & NER extraction (via Skylark-lite)
  - [ ] Lead scoring (BANT) (via Skylark-pro reasoning)
  - [ ] Auto-create opportunity
- [ ] Implementasi Pipeline Agent
  - [ ] Stage transition logic (via Skylark-pro)
  - [ ] Win probability model
  - [ ] Next best action recommendation
- [ ] Implementasi Insight Agent
  - [ ] Forecast calculation
  - [ ] Anomaly detection
  - [ ] Natural language insight generation (via Skylark-pro)
- [ ] Setup Celery task queue untuk async agent execution
- [ ] Build tool registry & function calling schema
- [ ] **Implementasi context caching untuk efisiensi token BytePlus**

### Phase 3: Frontend Web App (Minggu 8-11)
- [ ] Layout & navigation (sidebar, header)
- [ ] Opportunities page (list + detail + create form)
- [ ] Pipeline Kanban board (drag & drop)
- [ ] Activity timeline view
- [ ] Task management UI
- [ ] Real-time notifications (WebSocket)
- [ ] Agent activity log viewer
- [ ] Responsive design (mobile-friendly)

### Phase 4: Tableau Dashboard Integration (Minggu 10-12)
- [ ] Setup Tableau Server / Cloud account
- [ ] Connect Tableau ke PostgreSQL
- [ ] Buat 4 Workbook (Funnel, Forecast, Rep, Health)
- [ ] Setup row-level security
- [ ] Embed dashboard via Tableau JS API
- [ ] Implementasi filtering & drill-down
- [ ] Setup auto-refresh schedule
- [ ] Test performance & optimize

### Phase 5: Integration & Polish (Minggu 13-14)
- [ ] End-to-end integration testing
- [ ] AI agent → Dashboard data flow validation
- [ ] Performance optimization (query, caching)
- [ ] Error handling & fallback logic
- [ ] User acceptance testing (UAT)
- [ ] Documentation (API docs, user guide)

### Phase 6: Deployment & Launch (Minggu 15-16)
- [ ] Production deployment (Docker / Kubernetes)
- [ ] Setup monitoring (Grafana + Prometheus)
- [ ] Setup logging (Loki)
- [ ] Backup strategy & disaster recovery
- [ ] Launch & onboarding

---

## 10. Struktur Folder Proyek

```
renrnd-sales-agentic/
│
├── backend/                          # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                   # Entry point
│   │   ├── config.py                 # Konfigurasi (env, DB, dll)
│   │   ├── api/                      # API Routes
│   │   │   ├── v1/
│   │   │   │   ├── opportunities.py
│   │   │   │   ├── pipeline.py
│   │   │   │   ├── activities.py
│   │   │   │   ├── tasks.py
│   │   │   │   ├── agents.py         # Agent control endpoints
│   │   │   │   └── dashboard.py
│   │   ├── agents/                   # Agentic AI Components
│   │   │   ├── orchestrator.py       # Main agent coordinator
│   │   │   ├── opportunity_agent.py
│   │   │   ├── pipeline_agent.py
│   │   │   ├── insight_agent.py
│   │   │   ├── tools/                # Tool definitions
│   │   │   │   ├── opportunity_tools.py
│   │   │   │   ├── pipeline_tools.py
│   │   │   │   └── insight_tools.py
│   │   │   └── prompts/             # LLM prompt templates
│   │   ├── models/                   # SQLAlchemy ORM Models
│   │   ├── schemas/                  # Pydantic Schemas
│   │   ├── services/                 # Business Logic
│   │   ├── db/                       # Database & Migrations
│   │   │   ├── database.py
│   │   │   └── migrations/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                         # Next.js Web App
│   ├── src/
│   │   ├── app/                      # App Router pages
│   │   │   ├── dashboard/            # Tableau embedded dashboard
│   │   │   ├── opportunities/        # Opportunities CRUD
│   │   │   ├── pipeline/             # Kanban board
│   │   │   ├── activities/           # Activity timeline
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── dashboard/            # Dashboard components
│   │   │   ├── pipeline/             # Pipeline components
│   │   │   └── agents/               # Agent activity views
│   │   ├── lib/
│   │   │   ├── api.ts                # API client
│   │   │   └── websocket.ts          # WebSocket client
│   │   ├── stores/                   # Zustand stores
│   │   └── types/                    # TypeScript types
│   ├── package.json
│   └── Dockerfile
│
├── tableau/                           # Tableau Workbook Files
│   ├── workbooks/
│   │   ├── sales_funvel.twbx
│   │   ├── revenue_forecast.twbx
│   │   ├── rep_performance.twbx
│   │   └── pipeline_health.twbx
│   └── README.md                      # Tableau setup guide
│
├── docker-compose.yml                 # Local dev environment
├── docker-compose.prod.yml            # Production compose
├── .github/
│   └── workflows/                     # CI/CD pipelines
├── docs/                              # Documentation
│   ├── api/                           # API documentation
│   ├── architecture/                  # Architecture diagrams
│   └── user-guide/                    # End-user guide
├── RENCANA_APLIKASI_AGENTIC_AI_SALES.md  # File ini
└── README.md
```

---

## 11. Estimasi Timeline & Milestone

| Fase | Durasi | Milestone | Deliverable |
|------|--------|-----------|-------------|
| Phase 0 | 2 minggu | M1: Foundation Ready | Repo, DB, Docker, CI/CD |
| Phase 1 | 3 minggu | M2: Backend MVP | API CRUD berfungsi |
| Phase 2 | 4 minggu | M3: AI Agents Active | 3 Agent beroperasi |
| Phase 3 | 4 minggu | M4: Frontend MVP | Web App usable |
| Phase 4 | 3 minggu | M5: Dashboard Live | Tableau dashboards embedded |
| Phase 5 | 2 minggu | M6: Integration Done | E2E tested |
| Phase 6 | 2 minggu | M7: Production Launch | Deployed & monitored |
| **Total** | **~16 minggu** | | |

### Gantt Chart (Simplified)

```
Minggu:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
Phase 0: ██ ██
Phase 1:       ██ ██ ██
Phase 2:             ██ ██ ██ ██
Phase 3:                   ██ ██ ██ ██
Phase 4:                         ██ ██ ██
Phase 5:                              ██ ██
Phase 6:                                   ██ ██
```

---

## 12. Risiko & Mitigasi

| # | Risiko | Probabilitas | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 1 | LLM hallucination membuat opportunity salah | Sedang | Tinggi | Human-in-the-loop approval sebelum create; validation rules |
| 2 | Tableau licensing cost tinggi | Tinggi | Sedang | Pertimbangkan alternatif open-source (Apache Superset) |
| 3 | LLM API cost membengkak | Sedang | Sedang | Caching, batching, model tiering (Skylark-pro untuk reasoning, Skylark-lite untuk simple tasks), context caching BytePlus |
| 4 | Data quality rendah dari source | Sedang | Tinggi | Data validation pipeline, enrichment fallback |
| 5 | Pipeline complexity (multi-agent race condition) | Sedang | Tinggi | State management dengan LangGraph, idempotent operations |
| 6 | Tableau dashboard performance lambat | Rendah | Sedang | Materialized views, extract vs live, query optimization |
| 7 | User adoption rendah | Sedang | Tinggi | Training, UX simplicity, phased rollout |

---

## Catatan Tambahan

### Alternatif Tech Stack (Jika Tableau Tidak Feasible)

Jika licensing Tableau menjadi kendala, berikut alternatif yang direkomendasikan:

| Alternatif | Kelebihan | Kekurangan |
|-----------|-----------|------------|
| **Apache Superset** | Open-source, gratis, Python-native | Kurang polished, setup lebih complex |
| **Metabase** | Open-source, user-friendly | Lebih basic, customization terbatas |
| **Grafana** | Real-time, powerful | Bukan untuk BI/analytics traditional |
| **Custom (ECharts + Next.js)** | Full control, no license cost | Development effort tinggi |

### Pertimbangan Compliance & Security

- **Data Encryption:** At-rest (PostgreSQL TDE) + In-transit (TLS 1.3)
- **API Security:** Rate limiting, JWT auth, RBAC
- **LLM Data Privacy:** Tidak kirim PII ke LLM external (masking sebelum prompt)
- **Audit Trail:** Semua agent action tercatat di `agent_logs` table
- **GDPR/PDP Compliance:** Data subject rights, consent management, retention policy

---

---

## 13. Panduan Langkah-demi-Langkah: Dari Instalasi hingga Selesai

> Bagian ini adalah **playbook eksekusi lengkap** — setiap langkah dapat diikuti secara berurutan dari nol hingga aplikasi production-ready.

---

### Langkah 1: Prasyarat & Instalasi Tools

#### 1.1 Instalasi Software Wajib

```bash
# 1. Git
git --version          # Pastikan terinstall (min v2.40+)

# 2. Python 3.11+
python3 --version     # min 3.11

# 3. Node.js 20+ (LTS)
node --version         # min v20.x
npm --version

# 4. Docker & Docker Compose
docker --version      # min v24.x
docker compose version

# 5. PostgreSQL client (opsional, untuk debugging)
psql --version         # min v16

# 6. Tableau Desktop (trial 14 hari) atau Tableau Public
#    Download dari: https://www.tableau.com/products/trial
```

#### 1.2 Setup Akun BytePlus ModelArk

```
1. Buka https://console.byteplus.com/
2. Daftar akun (sign up) dengan email
3. Navigasi ke: ModelArk > Model Activation
4. Aktifkan model berikut:
   ✅ skylark-pro         (untuk reasoning kompleks)
   ✅ skylark-lite        (untuk tugas sederhana)
   ✅ skylark-embedding-vision  (untuk text/multimodal embedding)
5. Navigasi ke: ModelArk > API Key Management
6. Klik "Create API Key" → simpan sebagai ARK_API_KEY
7. Cek billing: pastikan ada saldo/token plan aktif
   (Token plan: pay-as-you-go atau subscription)
```

#### 1.3 Test Koneksi BytePlus API

Buat file test sederhana:

```python
# test_byteplus.py
import os
from openai import OpenAI

# BytePlus ModelArk menggunakan OpenAI-compatible API
client = OpenAI(
    base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
    api_key=os.environ.get("ARK_API_KEY"),
)

# Test 1: Chat Completion (Skylark-pro)
response = client.chat.completions.create(
    model="skylark-pro",
    messages=[
        {"role": "system", "content": "Anda adalah asisten sales AI."},
        {"role": "user", "content": "Apa itu BANT dalam sales?"},
    ],
)
print("✅ Skylark-pro chat OK:", response.choices[0].message.content[:100])

# Test 2: Embedding (skylark-embedding-vision)
embedding = client.embeddings.create(
    model="skylark-embedding-vision",
    input="PT Maju Jaya membutuhkan sistem CRM",
)
print(f"✅ Embedding OK: dim={len(embedding.data[0].embedding)}")
```

```bash
export ARK_API_KEY="your_api_key_here"
pip install openai --break-system-packages
python test_byteplus.py
```

---

### Langkah 2: Inisialisasi Proyek (Monorepo)

```bash
# Buat folder proyek utama
mkdir renrnd-sales-agentic
cd renrnd-sales-agentic

# Inisialisasi git
git init

# Buat struktur dasar
mkdir -p backend/app/{api/v1,agents/tools,agents/prompts,models,schemas,services,db/migrations,utils}
mkdir -p backend/tests
mkdir -p frontend
mkdir -p tableau/workbooks
mkdir -p docs/{api,architecture,user-guide}
mkdir -p .github/workflows

# Buat .gitignore
cat > .gitignore << 'EOF'
# Environment
.env
.env.local
.env.production
*.env

# Python
__pycache__/
*.pyc
*.pyo
venv/
.venv/
*.egg-info/
dist/
build/

# Node
node_modules/
.next/
out/

# Docker
docker-compose.override.yml

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
logs/
EOF

git add -A && git commit -m "feat: init monorepo structure"
```

---

### Langkah 3: Setup Docker Compose (Infrastructure)

Buat `docker-compose.yml` di root proyek:

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: rsa_postgres
    environment:
      POSTGRES_USER: rsa_admin
      POSTGRES_PASSWORD: rsa_dev_password
      POSTGRES_DB: rsa_sales
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/app/db/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rsa_admin -d rsa_sales"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: rsa_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: rsa_backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://rsa_admin:rsa_dev_password@postgres:5432/rsa_sales
      - REDIS_URL=redis://redis:6379/0
      - ARK_API_KEY=${ARK_API_KEY}
      - ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
      - LLM_MODEL_PRO=skylark-pro
      - LLM_MODEL_LITE=skylark-lite
      - EMBEDDING_MODEL=skylark-embedding-vision
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  celery_worker:
    build: ./backend
    container_name: rsa_celery
    environment:
      - DATABASE_URL=postgresql+asyncpg://rsa_admin:rsa_dev_password@postgres:5432/rsa_sales
      - REDIS_URL=redis://redis:6379/0
      - ARK_API_KEY=${ARK_API_KEY}
      - ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
    depends_on:
      - redis
      - postgres
    volumes:
      - ./backend:/app
    command: celery -A app.celery_app worker --loglevel=info

  frontend:
    build: ./frontend
    container_name: rsa_frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

Buat `.env` di root:

```bash
# .env (JANGAN commit file ini!)
ARK_API_KEY=your_byteplus_api_key_here

# Tableau
TABLEAU_SERVER=https://your-tableau-server.com
TABLEAU_TOKEN_NAME=your_token_name
TABLEAU_TOKEN_SECRET=your_token_secret
TABLEAU_SITE_ID=your_site_id

# App
JWT_SECRET=your_jwt_secret_change_me
```

Jalankan infrastructure:

```bash
# Start hanya DB & Redis dulu (tanpa app containers)
docker compose up -d postgres redis

# Cek status
docker compose ps

# Test koneksi DB
docker exec -it rsa_postgres psql -U rsa_admin -d rsa_sales -c "SELECT 1;"
```

---

### Langkah 4: Database Schema & Migration

Buat `backend/app/db/init.sql`:

```sql
-- init.sql (dijalankan otomatis saat container pertama kali start)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Accounts (perusahaan customer)
CREATE TABLE IF NOT EXISTS accounts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    industry    VARCHAR(100),
    website     VARCHAR(255),
    size        VARCHAR(50),
    region      VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Contacts (orang di customer)
CREATE TABLE IF NOT EXISTS contacts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    role        VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Stages (tahapan pipeline)
CREATE TABLE IF NOT EXISTS stages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    "order"     INT NOT NULL,
    probability FLOAT DEFAULT 0.0,
    is_closed   BOOLEAN DEFAULT FALSE,
    is_won      BOOLEAN DEFAULT FALSE
);

-- Seed default stages
INSERT INTO stages (name, "order", probability, is_closed) VALUES
    ('Prospecting', 1, 0.10, FALSE),
    ('Qualification', 2, 0.25, FALSE),
    ('Proposal', 3, 0.50, FALSE),
    ('Negotiation', 4, 0.70, FALSE),
    ('Closed Won', 5, 1.00, TRUE),
    ('Closed Lost', 6, 0.00, TRUE)
ON CONFLICT DO NOTHING;

-- Users (sales reps)
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    role        VARCHAR(50) DEFAULT 'sales_rep',
    quota       DECIMAL(15,2) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID REFERENCES accounts(id),
    contact_id      UUID REFERENCES contacts(id),
    name            VARCHAR(255) NOT NULL,
    stage_id        UUID REFERENCES stages(id),
    value           DECIMAL(15,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'IDR',
    close_date      DATE,
    win_probability FLOAT DEFAULT 0.0,
    owner_id        UUID REFERENCES users(id),
    source          VARCHAR(50),
    ai_metadata     JSONB,
    embedding       vector(1024),  -- Skylark embedding dimension
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Activities (log aktivitas sales)
CREATE TABLE IF NOT EXISTS activities (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opp_id      UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,  -- call, email, meeting, note
    description TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tasks (follow-up tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opp_id      UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    due_date    DATE,
    status      VARCHAR(20) DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Agent Logs (audit trail AI agent)
CREATE TABLE IF NOT EXISTS agent_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type  VARCHAR(50) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    input       JSONB,
    output      JSONB,
    token_usage INT DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'success',
    timestamp   TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_opp_stage ON opportunities(stage_id);
CREATE INDEX idx_opp_owner ON opportunities(owner_id);
CREATE INDEX idx_opp_close_date ON opportunities(close_date);
CREATE INDEX idx_opp_embedding ON opportunities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_activities_opp ON activities(opp_id);
CREATE INDEX idx_agent_logs_type ON agent_logs(agent_type, timestamp);

-- ============================================
-- MATERIALIZED VIEWS (untuk Tableau)
-- ============================================
CREATE MATERIALIZED VIEW mv_funnel_summary AS
SELECT
    s.name AS stage_name,
    s."order" AS stage_order,
    COUNT(o.id) AS deal_count,
    COALESCE(SUM(o.value), 0) AS total_value,
    COALESCE(AVG(o.win_probability), 0) AS avg_win_prob,
    DATE_TRUNC('month', o.created_at) AS month
FROM stages s
LEFT JOIN opportunities o ON o.stage_id = s.id
GROUP BY s.name, s."order", DATE_TRUNC('month', o.created_at);

CREATE MATERIALIZED VIEW mv_forecast_data AS
SELECT
    DATE_TRUNC('month', o.close_date) AS close_month,
    COALESCE(SUM(o.value * o.win_probability), 0) AS weighted_pipeline,
    COALESCE(SUM(o.value), 0) AS unweighted_pipeline,
    COUNT(o.id) AS deal_count,
    COALESCE(AVG(o.win_probability), 0) AS avg_probability
FROM opportunities o
JOIN stages s ON o.stage_id = s.id
WHERE s.is_closed = FALSE
GROUP BY DATE_TRUNC('month', o.close_date)
ORDER BY close_month;

CREATE MATERIALIZED VIEW mv_rep_performance AS
SELECT
    u.id AS rep_id,
    u.name AS rep_name,
    COUNT(o.id) AS total_deals,
    COUNT(CASE WHEN s.is_won THEN 1 END) AS won_deals,
    COALESCE(SUM(CASE WHEN s.is_won THEN o.value ELSE 0 END), 0) AS won_revenue,
    COALESCE(AVG(o.value), 0) AS avg_deal_size,
    u.quota AS quota
FROM users u
LEFT JOIN opportunities o ON o.owner_id = u.id
LEFT JOIN stages s ON o.stage_id = s.id
WHERE u.role = 'sales_rep'
GROUP BY u.id, u.name, u.quota;
```

Apply migration:

```bash
# Reset & recreate DB (jalankan ulang init.sql)
docker compose down -v
docker compose up -d postgres redis

# Tunggu postgres ready
sleep 5

# Verifikasi tables
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "\dt"

# Verifikasi pgvector
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "SELECT extname FROM pg_extension;"

# Verifikasi stages
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "SELECT * FROM stages;"
```

---

### Langkah 5: Setup Backend (FastAPI)

#### 5.1 Dependencies

Buat `backend/requirements.txt`:

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.2
pydantic==2.9.0
pydantic-settings==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
openai==1.51.0
langgraph==0.2.34
celery==5.4.0
redis==5.0.8
pgvector==0.3.4
httpx==0.27.0
python-multipart==0.0.12
psycopg2-binary==2.9.9
pytest==8.3.3
pytest-asyncio==0.24.0
```

Buat `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Install dependencies lokal (untuk development):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

#### 5.2 Konfigurasi

Buat `backend/app/config.py`:

```python
# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rsa_admin:rsa_dev_password@localhost:5432/rsa_sales"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # BytePlus ModelArk
    ARK_API_KEY: str = ""
    ARK_BASE_URL: str = "https://ark.ap-southeast.bytepluses.com/api/v3"
    LLM_MODEL_PRO: str = "skylark-pro"
    LLM_MODEL_LITE: str = "skylark-lite"
    EMBEDDING_MODEL: str = "skylark-embedding-vision"

    # JWT
    JWT_SECRET: str = "change_me_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # App
    APP_NAME: str = "RenRND Sales Agentic AI"
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
```

#### 5.3 LLM Client (BytePlus ModelArk)

Buat `backend/app/llm_client.py`:

```python
# backend/app/llm_client.py
"""BytePlus ModelArk LLM & Embedding client (OpenAI-compatible)."""
from openai import AsyncOpenAI
from app.config import settings

# Async client untuk chat completions & tool calling
llm_client = AsyncOpenAI(
    base_url=settings.ARK_BASE_URL,
    api_key=settings.ARK_API_KEY,
)

async def chat_pro(messages: list, tools: list = None, temperature: float = 0.7):
    """Skylark-pro untuk reasoning kompleks (stage transition, BANT scoring)."""
    return await llm_client.chat.completions.create(
        model=settings.LLM_MODEL_PRO,
        messages=messages,
        tools=tools,
        temperature=temperature,
    )

async def chat_lite(messages: list, temperature: float = 0.3):
    """Skylark-lite untuk tugas sederhana (NER, classification, summary)."""
    return await llm_client.chat.completions.create(
        model=settings.LLM_MODEL_LITE,
        messages=messages,
        temperature=temperature,
    )

async def embed_text(text: str) -> list[float]:
    """Skylark embedding untuk RAG / similarity search."""
    response = await llm_client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding
```

#### 5.4 Database Models (SQLAlchemy)

Buat `backend/app/db/database.py`:

```python
# backend/app/db/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

Buat `backend/app/models/__init__.py` dengan ORM models:

```python
# backend/app/models/__init__.py
import uuid
from datetime import date, datetime
from sqlalchemy import String, Integer, Float, Text, Boolean, ForeignKey, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.db.database import Base

class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(255))
    size: Mapped[str | None] = mapped_column(String(50))
    region: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Stage(Base):
    __tablename__ = "stages"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    order: Mapped[int] = mapped_column(Integer)
    probability: Mapped[float] = mapped_column(Float, default=0.0)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False)

class Opportunity(Base):
    __tablename__ = "opportunities"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"))
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id"))
    name: Mapped[str] = mapped_column(String(255))
    stage_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stages.id"))
    value: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="IDR")
    close_date: Mapped[date | None] = mapped_column(Date)
    win_probability: Mapped[float] = mapped_column(Float, default=0.0)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str | None] = mapped_column(String(50))
    ai_metadata: Mapped[dict | None] = mapped_column(default=None)
    embedding = mapped_column(Vector(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Activity(Base):
    __tablename__ = "activities"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    opp_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    opp_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="open")
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

class AgentLog(Base):
    __tablename__ = "agent_logs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    agent_type: Mapped[str] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(100))
    input: Mapped[dict | None] = mapped_column(default=None)
    output: Mapped[dict | None] = mapped_column(default=None)
    token_usage: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="success")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    role: Mapped[str] = mapped_column(String(50), default="sales_rep")
    quota: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

#### 5.5 FastAPI Entry Point

Buat `backend/app/main.py`:

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Import & include routers (akan dibuat di langkah berikutnya)
# from app.api.v1 import opportunities, pipeline, activities, tasks, agents, dashboard
# app.include_router(opportunities.router, prefix="/api/v1")
# ...
```

Test backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Buka http://localhost:8000/docs → Swagger UI
```

---

### Langkah 6: Implementasi API CRUD

#### 6.1 Schemas (Pydantic)

Buat `backend/app/schemas/opportunity.py`:

```python
# backend/app/schemas/opportunity.py
import uuid
from datetime import date
from pydantic import BaseModel

class OpportunityCreate(BaseModel):
    account_id: uuid.UUID | None = None
    name: str
    stage_id: uuid.UUID | None = None
    value: float
    currency: str = "IDR"
    close_date: date | None = None
    owner_id: uuid.UUID | None = None
    source: str | None = None

class OpportunityUpdate(BaseModel):
    name: str | None = None
    stage_id: uuid.UUID | None = None
    value: float | None = None
    close_date: date | None = None
    win_probability: float | None = None

class OpportunityResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID | None
    name: str
    stage_id: uuid.UUID | None
    value: float
    currency: str
    close_date: date | None
    win_probability: float
    owner_id: uuid.UUID | None
    source: str | None
    ai_metadata: dict | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
```

#### 6.2 API Routes

Buat `backend/app/api/v1/opportunities.py`:

```python
# backend/app/api/v1/opportunities.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models import Opportunity
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate, OpportunityResponse

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

@router.get("", response_model=list[OpportunityResponse])
async def list_opportunities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Opportunity).order_by(Opportunity.created_at.desc()))
    return result.scalars().all()

@router.post("", response_model=OpportunityResponse, status_code=201)
async def create_opp(data: OpportunityCreate, db: AsyncSession = Depends(get_db)):
    opp = Opportunity(**data.model_dump())
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return opp

@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opp(opp_id: str, db: AsyncSession = Depends(get_db)):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    return opp

@router.patch("/{opp_id}", response_model=OpportunityResponse)
async def update_opp(opp_id: str, data: OpportunityUpdate, db: AsyncSession = Depends(get_db)):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(opp, k, v)
    await db.commit()
    await db.refresh(opp)
    return opp

@router.delete("/{opp_id}", status_code=204)
async def delete_opp(opp_id: str, db: AsyncSession = Depends(get_db)):
    opp = await db.get(Opportunity, opp_id)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    await db.delete(opp)
    await db.commit()
```

Registrasi router di `main.py`:

```python
# Tambahkan ke backend/app/main.py
from app.api.v1 import opportunities
app.include_router(opportunities.router, prefix="/api/v1")
```

Ulangi pola serupa untuk `pipeline.py`, `activities.py`, `tasks.py`, `agents.py`.

---

### Langkah 7: Implementasi Agentic AI (BytePlus + LangGraph)

#### 7.1 Tool Definitions

Buat `backend/app/agents/tools/opportunity_tools.py`:

```python
# backend/app/agents/tools/opportunity_tools.py
"""Tools yang dapat dipanggil oleh AI Agent (function calling via BytePlus ModelArk)."""
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Opportunity, Account, Stage
from app.llm_client import embed_text

async def tool_create_opportunity(db: AsyncSession, name: str, value: float,
                                   account_name: str = None, source: str = "ai_agent"):
    """Buat opportunity baru di database."""
    # Embed opportunity name untuk vector search
    embedding = await embed_text(f"{name} {account_name or ''}")

    opp = Opportunity(
        name=name,
        value=value,
        source=source,
        embedding=embedding,
    )
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return {"id": str(opp.id), "name": opp.name, "value": opp.value}

async def tool_search_similar_deals(db: AsyncSession, query: str, limit: int = 5):
    """Cari opportunity mirip menggunakan pgvector cosine similarity."""
    query_embedding = await embed_text(query)
    result = await db.execute(
        select(Opportunity)
        .order_by(Opportunity.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    deals = result.scalars().all()
    return [{"id": str(d.id), "name": d.name, "value": d.value} for d in deals]

async def tool_score_lead_bant(lead_info: dict):
    """
    Score lead berdasarkan BANT framework menggunakan Skylark-pro.
    Returns: {budget: 0-1, authority: 0-1, need: 0-1, timeline: 0-1, total: 0-1}
    """
    from app.llm_client import chat_pro

    prompt = f"""
    Analisis lead berikut dengan BANT framework (Budget, Authority, Need, Timeline).
    Berikan skor 0.0-1.0 untuk setiap dimensi, dan total skor.

    Lead info: {json.dumps(lead_info, indent=2)}

    Respond ONLY dalam format JSON:
    {{"budget": 0.0, "authority": 0.0, "need": 0.0, "timeline": 0.0, "total": 0.0, "reasoning": "..."}}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"total": 0.0, "error": "Failed to parse LLM response"}

# Tool schema untuk OpenAI function calling format
OPPORTUNITY_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "create_opportunity",
            "description": "Buat record opportunity baru di database",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nama opportunity"},
                    "value": {"type": "number", "description": "Nilai deal"},
                    "account_name": {"type": "string", "description": "Nama perusahaan"},
                    "source": {"type": "string", "description": "Sumber lead"},
                },
                "required": ["name", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "score_lead_bant",
            "description": "Score lead berdasarkan BANT framework",
            "parameters": {
                "type": "object",
                "properties": {
                    "budget": {"type": "string"},
                    "authority": {"type": "string"},
                    "need": {"type": "string"},
                    "timeline": {"type": "string"},
                },
            },
        },
    },
]
```

#### 7.2 Opportunity Agent

Buat `backend/app/agents/opportunity_agent.py`:

```python
# backend/app/agents/opportunity_agent.py
"""
Opportunity Agent: Mendeteksi & membuat opportunities dari raw input.
Menggunakan BytePlus ModelArk (Skylark-lite untuk NER, Skylark-pro untuk scoring).
"""
import json
from app.llm_client import chat_lite, chat_pro, embed_text
from app.agents.tools.opportunity_tools import tool_create_opportunity, tool_score_lead_bant
from app.models import AgentLog
from sqlalchemy.ext.asyncio import AsyncSession

async def extract_entities(raw_input: str) -> dict:
    """
    Ekstrak entitas (company, contact, need, budget) dari raw text.
    Menggunakan Skylark-lite (cepat & murah untuk NER).
    """
    prompt = f"""
    Ekstrak informasi berikut dari teks input. Respond ONLY dalam JSON.

    Teks: "{raw_input}"

    Format: {{
        "company_name": "...",
        "contact_name": "...",
        "contact_email": "...",
        "need": "...",
        "budget_mentioned": "...",
        "timeline": "...",
        "sentiment": "positive|neutral|negative"
    }}
    """
    response = await chat_lite(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "parse_failed", "raw": response.choices[0].message.content}

async def run_opportunity_agent(raw_input: str, db: AsyncSession) -> dict:
    """
    Main workflow Opportunity Agent:
    1. Extract entities (Skylark-lite)
    2. Score BANT (Skylark-pro)
    3. Jika score > threshold → create opportunity
    4. Log action
    """
    # Step 1: Entity extraction
    entities = await extract_entities(raw_input)

    # Step 2: BANT scoring
    bant_score = await tool_score_lead_bant(entities)

    # Step 3: Decision — create if score > 0.5
    created_opp = None
    if bant_score.get("total", 0) > 0.5:
        opp_name = f"{entities.get('company_name', 'Unknown')} - {entities.get('need', 'General')}"
        estimated_value = 50000000  # Default IDR 50M, bisa di-enhance
        created_opp = await tool_create_opportunity(
            db=db,
            name=opp_name,
            value=estimated_value,
            account_name=entities.get("company_name"),
            source="ai_agent",
        )

    # Step 4: Log
    log = AgentLog(
        agent_type="opportunity",
        action="run_opportunity_agent",
        input={"raw_input": raw_input},
        output={"entities": entities, "bant_score": bant_score, "created_opp": created_opp},
        token_usage=0,  # TODO: track actual token usage
        status="success",
    )
    db.add(log)
    await db.commit()

    return {
        "entities": entities,
        "bant_score": bant_score,
        "opportunity_created": created_opp is not None,
        "opportunity": created_opp,
    }
```

#### 7.3 Pipeline Agent

Buat `backend/app/agents/pipeline_agent.py`:

```python
# backend/app/agents/pipeline_agent.py
"""
Pipeline Agent: Evaluasi & rekomendasi stage transition, win probability, next best action.
Menggunakan BytePlus ModelArk Skylark-pro untuk reasoning.
"""
import json
from app.llm_client import chat_pro
from app.models import Opportunity, Stage, Activity, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

PIPELINE_TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "move_stage",
            "description": "Rekomendasi pemindahan deal ke stage berikutnya",
            "parameters": {
                "type": "object",
                "properties": {
                    "opp_id": {"type": "string"},
                    "target_stage": {"type": "string"},
                    "reasoning": {"type": "string"},
                },
                "required": ["opp_id", "target_stage"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "next_best_action",
            "description": "Rekomendasi tindakan terbaik untuk deal",
            "parameters": {
                "type": "object",
                "properties": {
                    "opp_id": {"type": "string"},
                    "action": {"type": "string", "description": "call|email|demo|follow_up|proposal"},
                    "description": {"type": "string"},
                },
                "required": ["opp_id", "action"],
            },
        },
    },
]

async def evaluate_deal(opp: Opportunity, activities: list[Activity], stages: list[Stage]) -> dict:
    """
    Evaluasi single deal: apakah siap maju stage? win probability? next action?
    """
    context = {
        "opp_name": opp.name,
        "current_value": opp.value,
        "current_stage": next((s.name for s in stages if s.id == opp.stage_id), "Unknown"),
        "win_probability": opp.win_probability,
        "close_date": str(opp.close_date) if opp.close_date else None,
        "days_to_close": (opp.close_date - datetime.utcnow().date()).days if opp.close_date else None,
        "activity_count": len(activities),
        "last_activity_days_ago": (
            (datetime.utcnow() - activities[-1].created_at).days if activities else 999
        ),
        "activities_summary": [
            {"type": a.type, "desc": a.description[:100] if a.description else ""}
            for a in activities[-10:]  # last 10 activities
        ],
    }

    prompt = f"""
    Anda adalah Sales Pipeline AI Agent. Analisis deal berikut dan berikan rekomendasi.

    Deal context: {json.dumps(context, indent=2)}

    Available stages: {[s.name for s in stages]}

    Berikan response dalam JSON:
    {{
        "should_advance": true/false,
        "target_stage": "stage name or null",
        "reasoning": "mengapa",
        "updated_win_probability": 0.0-1.0,
        "next_best_action": {{
            "action": "call|email|demo|follow_up|proposal|send_quote",
            "description": "detail tindakan",
            "priority": "high|medium|low"
        }},
        "risk_flags": ["list of concerns"]
    }}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "parse_failed"}

async def run_pipeline_agent(db: AsyncSession) -> list[dict]:
    """
    Scan semua active opportunities, evaluasi, dan return recommendations.
    """
    # Get all open opportunities
    opps = (await db.execute(
        select(Opportunity).join(Stage).where(Stage.is_closed == False)
    )).scalars().all()

    stages = (await db.execute(select(Stage).order_by(Stage.order))).scalars().all()

    results = []
    for opp in opps:
        # Get activities for this opp
        activities = (await db.execute(
            select(Activity).where(Activity.opp_id == opp.id).order_by(Activity.created_at)
        )).scalars().all()

        evaluation = await evaluate_deal(opp, activities, stages)

        # Update win probability if changed
        if "updated_win_probability" in evaluation:
            opp.win_probability = evaluation["updated_win_probability"]

        # Log
        log = AgentLog(
            agent_type="pipeline",
            action="evaluate_deal",
            input={"opp_id": str(opp.id), "opp_name": opp.name},
            output=evaluation,
            status="success",
        )
        db.add(log)
        results.append({
            "opp_id": str(opp.id),
            "opp_name": opp.name,
            "evaluation": evaluation,
        })

    await db.commit()
    return results
```

#### 7.4 Insight Agent

Buat `backend/app/agents/insight_agent.py`:

```python
# backend/app/agents/insight_agent.py
"""
Insight Agent: Generate narasi insight, forecast, dan deteksi anomali.
Menggunakan BytePlus ModelArk Skylark-pro.
"""
import json
from app.llm_client import chat_pro
from app.models import Opportunity, Stage, AgentLog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime

async def generate_daily_briefing(db: AsyncSession) -> dict:
    """
    Generate daily briefing: summary pipeline, insight, dan alert.
    """
    # Aggregate metrics
    total_pipeline = (await db.execute(
        select(func.sum(Opportunity.value * Opportunity.win_probability))
        .join(Stage).where(Stage.is_closed == False)
    )).scalar() or 0

    total_deals = (await db.execute(
        select(func.count(Opportunity.id)).join(Stage).where(Stage.is_closed == False)
    )).scalar() or 0

    avg_prob = (await db.execute(
        select(func.avg(Opportunity.win_probability))
        .join(Stage).where(Stage.is_closed == False)
    )).scalar() or 0

    metrics = {
        "total_weighted_pipeline": total_pipeline,
        "total_open_deals": total_deals,
        "avg_win_probability": float(avg_prob),
        "date": datetime.utcnow().isoformat(),
    }

    # Generate natural language insight via Skylark-pro
    prompt = f"""
    Anda adalah Sales Insight AI. Buat daily briefing singkat berdasarkan data pipeline berikut.
    Sertakan: summary utama, insight menarik, dan 2-3 alert/action items.

    Metrics: {json.dumps(metrics, indent=2)}

    Format response sebagai JSON:
    {{
        "summary": "ringkasan 2-3 kalimat",
        "insights": ["insight 1", "insight 2"],
        "alerts": ["alert 1", "alert 2"],
        "recommendation": "rekomendasi utama"
    }}
    """
    response = await chat_pro(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    try:
        briefing = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        briefing = {"summary": response.choices[0].message.content}

    # Log
    log = AgentLog(
        agent_type="insight",
        action="daily_briefing",
        input=metrics,
        output=briefing,
        status="success",
    )
    db.add(log)
    await db.commit()

    return {"metrics": metrics, "briefing": briefing}
```

#### 7.5 Agent API Endpoints

Buat `backend/app/api/v1/agents.py`:

```python
# backend/app/api/v1/agents.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.agents.opportunity_agent import run_opportunity_agent
from app.agents.pipeline_agent import run_pipeline_agent
from app.agents.insight_agent import generate_daily_briefing
from pydantic import BaseModel

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentTrigger(BaseModel):
    raw_input: str

@router.post("/opportunity/run")
async def trigger_opportunity_agent(data: AgentTrigger, db: AsyncSession = Depends(get_db)):
    """Trigger Opportunity Agent dengan raw input (email, meeting note, dll)."""
    return await run_opportunity_agent(data.raw_input, db)

@router.post("/pipeline/scan")
async def trigger_pipeline_agent(db: AsyncSession = Depends(get_db)):
    """Scan semua pipeline & generate recommendations."""
    return await run_pipeline_agent(db)

@router.get("/insight/briefing")
async def get_daily_briefing(db: AsyncSession = Depends(get_db)):
    """Get daily insight briefing."""
    return await generate_daily_briefing(db)
```

Registrasi di `main.py`:

```python
# Tambahkan ke backend/app/main.py
from app.api.v1 import opportunities, agents
app.include_router(opportunities.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
```

Test agent:

```bash
# Restart backend
uvicorn app.main:app --reload --port 8000

# Test Opportunity Agent
curl -X POST http://localhost:8000/api/v1/agents/opportunity/run \
  -H "Content-Type: application/json" \
  -d '{"raw_input": "PT Maju Jaya menghubungi kita, mereka butuh sistem CRM baru. Budget sekitar 500 juta, keputusan dalam 2 bulan. Contact: Budi, CTO."}'

# Test Pipeline Agent
curl -X POST http://localhost:8000/api/v1/agents/pipeline/scan

# Test Insight Agent
curl http://localhost:8000/api/v1/agents/insight/briefing
```

---

### Langkah 8: Setup Celery untuk Background Agent Execution

Buat `backend/app/celery_app.py`:

```python
# backend/app/celery_app.py
import asyncio
from celery import Celery
from app.config import settings

celery_app = Celery("rsa_workers", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Jakarta",
    enable_utc=True,
    beat_schedule={
        "pipeline-scan-hourly": {
            "task": "tasks.scan_pipeline",
            "schedule": 3600,  # Every hour
        },
        "daily-briefing": {
            "task": "tasks.daily_briefing",
            "schedule": 86400,  # Daily
        },
    },
)

@celery_app.task(name="tasks.scan_pipeline")
def scan_pipeline():
    """Scheduled: scan pipeline setiap jam."""
    from app.db.database import async_session
    from app.agents.pipeline_agent import run_pipeline_agent
    async def _run():
        async with async_session() as db:
            return await run_pipeline_agent(db)
    return asyncio.run(_run())

@celery_app.task(name="tasks.daily_briefing")
def daily_briefing():
    """Scheduled: daily insight briefing."""
    from app.db.database import async_session
    from app.agents.insight_agent import generate_daily_briefing
    async def _run():
        async with async_session() as db:
            return await generate_daily_briefing(db)
    return asyncio.run(_run())
```

---

### Langkah 9: Setup Frontend (Next.js)

```bash
# Create Next.js app
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Install dependencies
npm install @tanstack/react-query zustand socket.io-client
npx shadcn@latest init
npx shadcn@latest add button card table tabs badge dialog input label select

# Buat API client
cat > src/lib/api.ts << 'EOF'
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}
EOF
```

Buat halaman Pipeline Kanban `src/app/pipeline/page.tsx`:

```tsx
// src/app/pipeline/page.tsx (simplified)
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Opportunity {
  id: string;
  name: string;
  value: number;
  win_probability: number;
  stage_id: string;
}

export default function PipelinePage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState([]);

  useEffect(() => {
    apiFetch("/opportunities").then(setOpps);
    apiFetch("/stages").then(setStages);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Sales Pipeline</h1>
      <div className="flex gap-4 overflow-x-auto">
        {stages.map((stage: any) => (
          <div key={stage.id} className="w-72 shrink-0">
            <div className="bg-gray-100 rounded-lg p-3 mb-2">
              <h2 className="font-semibold">{stage.name}</h2>
              <span className="text-sm text-gray-500">
                {opps.filter(o => o.stage_id === stage.id).length} deals
              </span>
            </div>
            <div className="space-y-2">
              {opps
                .filter(o => o.stage_id === stage.id)
                .map(opp => (
                  <div key={opp.id} className="bg-white border rounded-lg p-3 shadow-sm">
                    <p className="font-medium">{opp.name}</p>
                    <p className="text-sm text-gray-600">
                      Rp {opp.value.toLocaleString("id-ID")}
                    </p>
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 rounded-full h-2"
                          style={{ width: `${opp.win_probability * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(opp.win_probability * 100)}% win prob
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Langkah 10: Setup Tableau Dashboard

#### 10.1 Connect Tableau ke PostgreSQL

```
1. Buka Tableau Desktop
2. Connect → To a Server → PostgreSQL
3. Isi:
   - Server: localhost (atau IP Docker host)
   - Port: 5432
   - Database: rsa_sales
   - Username: rsa_admin
   - Password: rsa_dev_password
4. Klik "Sign In"
5. Pilih tables: opportunities, stages, activities, mv_funnel_summary, mv_forecast_data
```

#### 10.2 Buat Workbook: Sales Funnel Dashboard

```
Sheet 1: Funnel Chart
  - Drag "Stage Name" ke Columns
  - Drag "Total Value" ke Rows → pilih "Sum"
  - Marks: Automatic → Gantt Chart
  - Filter: Month = This Month

Sheet 2: Conversion Rate
  - Drag "Stage Order" ke Columns
  - Drag "Deal Count" ke Rows
  - Quick Table Calculation → Percent Difference

Sheet 3: Stage Duration
  - Drag "Stage Name" ke Columns
  - Drag "Days in Stage" (calculated field) ke Rows
  - Marks: Box Plot

Dashboard: Drag semua sheets → layout horizontal
  - Add Filter: Date Range, Region, Sales Rep
  - Set size: 1200x800
```

#### 10.3 Publish ke Tableau Server/Cloud

```
1. Server → Publish Workbook
2. Pilih site & project
3. Set permissions:
   - Sales Rep: View (filtered by row-level security)
   - Sales Manager: View All + Interact
   - Admin: Full
4. Publish
5. Copy embed URL: https://your-tableau-server/views/SalesFunnel/Dashboard1
```

#### 10.4 Embed ke Web App

Buat `src/app/dashboard/page.tsx`:

```tsx
// src/app/dashboard/page.tsx
"use client";
import { useEffect, useRef } from "react";

export default function DashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Tableau JS API
    const script = document.createElement("script");
    script.src = "https://public.tableau.com/javascripts/api/viz_v1.js";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (containerRef.current && (window as any).tableau) {
        const viz = new (window as any).tableau.Viz(
          containerRef.current,
          "https://your-tableau-server/views/SalesFunnel/Dashboard1",
          {
            width: "100%",
            height: "800px",
            hideTabs: true,
            hideToolbar: false,
          }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Sales Dashboard</h1>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
```

---

### Langkah 11: Seed Data untuk Testing

Buat `backend/app/db/seed.py`:

```python
# backend/app/db/seed.py
"""Seed dummy data untuk testing."""
import asyncio
from app.db.database import async_session, engine, Base
from app.models import Account, Contact, User, Opportunity, Stage, Activity
from app.llm_client import embed_text
from sqlalchemy import select
import uuid

async def seed():
    async with async_session() as db:
        # Cek apakah sudah ada data
        existing = (await db.execute(select(Account))).scalars().first()
        if existing:
            print("Data sudah ada, skip seed.")
            return

        # Users (Sales Reps)
        reps = [
            User(name="Andi Wijaya", email="andi@renrnd.com", role="sales_rep", quota=500000000),
            User(name="Siti Rahma", email="siti@renrnd.com", role="sales_rep", quota=500000000),
            User(name="Budi Santoso", email="budi@renrnd.com", role="sales_rep", quota=500000000),
        ]
        db.add_all(reps)

        # Accounts
        accounts = [
            Account(name="PT Maju Jaya", industry="Technology", website="majujaya.co.id", size="50-200", region="Jakarta"),
            Account(name="CV Sentosa Abadi", industry="Manufacturing", website="sentosa.com", size="10-50", region="Surabaya"),
            Account(name="PT Global Digital", industry="Finance", website="globaldig.id", size="200-500", region="Jakarta"),
            Account(name="PT Bumi Sehat", industry="Healthcare", website="bumisehat.id", size="50-200", region="Bandung"),
        ]
        db.add_all(accounts)
        await db.flush()

        # Stages
        stages = (await db.execute(select(Stage).order_by(Stage.order))).scalars().all()

        # Opportunities
        import random
        for i in range(20):
            account = random.choice(accounts)
            rep = random.choice(reps)
            stage = random.choice(stages[:4])  # Open stages only
            value = random.choice([25e6, 50e6, 100e6, 150e6, 200e6])
            name = f"{account.name} - Deal #{i+1}"

            # Generate embedding
            embedding = await embed_text(name)

            opp = Opportunity(
                account_id=account.id,
                name=name,
                stage_id=stage.id,
                value=value,
                currency="IDR",
                close_date="2026-12-31",
                win_probability=stage.probability,
                owner_id=rep.id,
                source=random.choice(["inbound", "referral", "outbound", "event"]),
                embedding=embedding,
            )
            db.add(opp)

        await db.commit()
        print("✅ Seed data berhasil: 4 accounts, 3 reps, 20 opportunities")

asyncio.run(seed())
```

```bash
cd backend
source .venv/bin/activate
python -m app.db.seed
```

---

### Langkah 12: End-to-End Testing

```bash
# 1. Start semua services
docker compose up -d

# 2. Cek semua container running
docker compose ps

# 3. Test API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/opportunities | python3 -m json.tool | head -20

# 4. Test Opportunity Agent (BytePlus Skylark)
curl -X POST http://localhost:8000/api/v1/agents/opportunity/run \
  -H "Content-Type: application/json" \
  -d '{"raw_input": "Email dari PT Tekno Maju: Halo, kami tertarik dengan produk CRM Anda. Kami perusahaan 200 orang, budget 300 juta, target implementasi Q1 2027. Contact: Dewi, Head of IT."}'

# 5. Test Pipeline Agent
curl -X POST http://localhost:8000/api/v1/agents/pipeline/scan

# 6. Test Insight Agent
curl http://localhost:8000/api/v1/agents/insight/briefing

# 7. Test Frontend
# Buka http://localhost:3000 → cek halaman Pipeline & Dashboard

# 8. Test Tableau Dashboard
# Buka http://localhost:3000/dashboard → cek embedded Tableau

# 9. Refresh materialized views
docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c \
  "REFRESH MATERIALIZED VIEW mv_funnel_summary; REFRESH MATERIALIZED VIEW mv_forecast_data; REFRESH MATERIALIZED VIEW mv_rep_performance;"
```

---

### Langkah 13: Deployment ke Production

#### 13.1 Build Docker Images

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Tag & push ke registry (opsional)
docker tag rsa_backend your-registry.com/rsa-backend:v1.0
docker tag rsa_frontend your-registry.com/rsa-frontend:v1.0
docker push your-registry.com/rsa-backend:v1.0
docker push your-registry.com/rsa-frontend:v1.0
```

#### 13.2 Production docker-compose

Buat `docker-compose.prod.yml`:

```yaml
# docker-compose.prod.yml
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_prod:/data

  backend:
    image: your-registry.com/rsa-backend:v1.0
    restart: always
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - ARK_API_KEY=${ARK_API_KEY}
      - ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
      - JWT_SECRET=${JWT_SECRET}
      - DEBUG=False
    depends_on:
      - postgres
      - redis
    command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

  celery_worker:
    image: your-registry.com/rsa-backend:v1.0
    restart: always
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - ARK_API_KEY=${ARK_API_KEY}
    command: celery -A app.celery_app worker --loglevel=warning --concurrency=4

  celery_beat:
    image: your-registry.com/rsa-backend:v1.0
    restart: always
    command: celery -A app.celery_app beat --loglevel=warning

  frontend:
    image: your-registry.com/rsa-frontend:v1.0
    restart: always
    ports:
      - "80:3000"
    depends_on:
      - backend

volumes:
  postgres_prod:
  redis_prod:
```

#### 13.3 Deploy

```bash
# SSH ke production server
ssh user@production-server

# Clone repo & set env
git clone your-repo.git
cd renrnd-sales-agentic
cp .env.example .env
# Edit .env dengan production values

# Deploy
docker compose -f docker-compose.prod.yml up -d

# Run migrations (jika belum)
docker exec rsa_backend alembic upgrade head

# Verify
curl http://localhost:8000/health
curl http://localhost:80
```

---

### Langkah 14: Monitoring & Maintenance

#### 14.1 Setup Monitoring (Grafana + Prometheus)

```yaml
# Tambahkan ke docker-compose.prod.yml
  prometheus:
    image: prom/prometheus
    restart: always
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    restart: always
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

volumes:
  grafana_data:
```

#### 14.2 Materialized View Auto-Refresh

Buat cron job untuk refresh materialized views:

```bash
# Tambahkan ke crontab (setiap 15 menit)
*/15 * * * * docker exec rsa_postgres psql -U rsa_admin -d rsa_sales -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_summary; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_forecast_data; REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rep_performance;"
```

Atau via Celery beat:

```python
# Tambahkan ke celery_app.py beat_schedule
"refresh-views": {
    "task": "tasks.refresh_views",
    "schedule": 900,  # 15 minutes
},
```

#### 14.3 Checklist Post-Deployment

- [ ] Semua API endpoints berfungsi (`/health`, `/api/v1/*`)
- [ ] BytePlus ModelArk API key valid & terpakai
- [ ] Celery worker & beat running (cek `docker compose logs celery_worker`)
- [ ] Frontend accessible di port 80/3000
- [ ] Tableau dashboard embedded & showing data
- [ ] Materialized views auto-refresh berjalan
- [ ] Agent logs tercatat di database (`SELECT * FROM agent_logs ORDER BY timestamp DESC LIMIT 10;`)
- [ ] Monitoring Grafana dashboard accessible
- [ ] Backup strategy aktif (daily PostgreSQL dump)
- [ ] Log rotation configured

---

### Checklist Final: Selesai Jika Semua Berikut Sudah ✅

| # | Item | Status |
|---|------|--------|
| 1 | Docker Compose (PostgreSQL + Redis + pgvector) running | ☐ |
| 2 | BytePlus ModelArk API key aktif (Skylark-pro, Skylark-lite, Skylark embedding) | ☐ |
| 3 | Database schema & seed data created | ☐ |
| 4 | FastAPI backend running di port 8000 | ☐ |
| 5 | API CRUD endpoints berfungsi (opportunities, pipeline, activities, tasks) | ☐ |
| 6 | Opportunity Agent (BytePlus Skylark) berfungsi | ☐ |
| 7 | Pipeline Agent (BytePlus Skylark) berfungsi | ☐ |
| 8 | Insight Agent (BytePlus Skylark) berfungsi | ☐ |
| 9 | Celery worker & beat untuk scheduled agents | ☐ |
| 10 | Next.js frontend running di port 3000 | ☐ |
| 11 | Pipeline Kanban board (drag & drop) | ☐ |
| 12 | Tableau dashboards (4 workbooks) published | ☐ |
| 13 | Tableau embedded di web app | ☐ |
| 14 | End-to-end test passed (Agent → DB → Dashboard) | ☐ |
| 15 | Production deployment (Docker prod) | ☐ |
| 16 | Monitoring (Grafana + Prometheus) aktif | ☐ |
| 17 | Materialized view auto-refresh aktif | ☐ |
| 18 | Backup strategy aktif | ☐ |
