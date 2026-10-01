# Database Schema — RenRND Sales Agentic AI

> Dokumen skema database untuk **RenRND Sales Agentic AI**.
> Database: PostgreSQL 16 + pgvector | File SQL: `backend/app/db/init.sql`
> Versi: 1.0.0 | Terakhir diperbarui: 2026-09-28

---

## Daftar Isi

1. [Extensions](#1-extensions)
2. [Tabel — Definisi Lengkap](#2-tabel--definisi-lengkap)
3. [Default Stages](#3-default-stages)
4. [Indexes](#4-indexes)
5. [Materialized Views](#5-materialized-views)
6. [ERD (Entity Relationship Diagram)](#6-erd-entity-relationship-diagram)
7. [Ringkasan Relasi](#7-ringkasan-relasi)

---

## 1. Extensions

Dua extension PostgreSQL diaktifkan saat inisialisasi database:

| Extension | Fungsi |
|-----------|--------|
| `vector` | pgvector — menyimpan dan melakukan similarity search pada vektor embedding (kolom `embedding vector(1024)`) |
| `uuid-ossp` | Generate UUID v4 secara default untuk primary key semua tabel (`uuid_generate_v4()`) |

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 2. Tabel — Definisi Lengkap

### 2.1 `accounts` — Perusahaan Customer

Menyimpan data perusahaan customer/prospect.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `name` | VARCHAR(255) | NOT NULL | — | Nama perusahaan |
| `industry` | VARCHAR(100) | — | NULL | Industri perusahaan |
| `website` | VARCHAR(255) | — | NULL | URL website |
| `size` | VARCHAR(50) | — | NULL | Ukuran perusahaan (mis. "Startup", "Enterprise") |
| `region` | VARCHAR(100) | — | NULL | Wilayah/region |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp pembuatan |
| `updated_at` | TIMESTAMP | — | `NOW()` | Timestamp update terakhir |

### 2.2 `contacts` — Orang di Customer

Menyimpan data individu/kontak di perusahaan customer.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `account_id` | UUID | FK → `accounts(id)` ON DELETE CASCADE | NULL | Relasi ke perusahaan |
| `name` | VARCHAR(255) | NOT NULL | — | Nama kontak |
| `email` | VARCHAR(255) | — | NULL | Email kontak |
| `phone` | VARCHAR(50) | — | NULL | Nomor telepon |
| `role` | VARCHAR(100) | — | NULL | Jabatan/peran |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp pembuatan |

> **Catatan:** `ON DELETE CASCADE` — jika account dihapus, semua contacts
> terkait ikut dihapus.

### 2.3 `stages` — Tahapan Pipeline

Mendefinisikan tahapan pipeline sales. Di-seed dengan 6 stage default.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `name` | VARCHAR(100) | NOT NULL | — | Nama stage |
| `order` | INT | NOT NULL | — | Urutan stage dalam pipeline |
| `probability` | FLOAT | — | `0.0` | Probabilitas default win |
| `is_closed` | BOOLEAN | — | `FALSE` | Apakah stage ini = closed (won/lost) |
| `is_won` | BOOLEAN | — | `FALSE` | Apakah stage ini = won |

### 2.4 `users` — Sales Representatives

Menyimpan data user sistem (sales reps, managers, admin).

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `name` | VARCHAR(255) | NOT NULL | — | Nama lengkap |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | — | Email (unique, untuk login) |
| `role` | VARCHAR(50) | — | `'sales_rep'` | Peran: sales_rep, manager, admin |
| `quota` | DECIMAL(15,2) | — | `0` | Target quota sales |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp pembuatan |

### 2.5 `opportunities` — Deal/Opportunity

Tabel utama untuk menyimpan deal/opportunity sales. Ini adalah core entity
dari sistem.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `account_id` | UUID | FK → `accounts(id)` | NULL | Perusahaan customer |
| `contact_id` | UUID | FK → `contacts(id)` | NULL | Kontak utama |
| `name` | VARCHAR(255) | NOT NULL | — | Nama deal/opportunity |
| `stage_id` | UUID | FK → `stages(id)` | NULL | Stage pipeline saat ini |
| `value` | DECIMAL(15,2) | NOT NULL | — | Nilai deal |
| `currency` | VARCHAR(3) | — | `'IDR'` | Mata uang (default Rupiah) |
| `close_date` | DATE | — | NULL | Target tanggal close |
| `win_probability` | FLOAT | — | `0.0` | Probabilitas win (0.0–1.0) |
| `owner_id` | UUID | FK → `users(id)` | NULL | Sales rep pemilik deal |
| `source` | VARCHAR(50) | — | NULL | Sumber lead (mis. "ai_agent", "referral") |
| `ai_metadata` | JSONB | — | NULL | Metadata tambahan dari AI Agent |
| `embedding` | vector(1024) | — | NULL | Vector embedding untuk semantic search |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp pembuatan |
| `updated_at` | TIMESTAMP | — | `NOW()` | Timestamp update terakhir |

> **Catatan:**
> - Kolom `embedding vector(1024)` di-generate oleh Opportunity Agent
>   menggunakan model `skylark-embedding-vision`.
> - Kolom `ai_metadata` menyimpan output AI Agent dalam format JSONB
>   (BANT score, entity extraction, dll).
> - Kolom `win_probability` di-update oleh Pipeline Agent setiap jam.

### 2.6 `activities` — Log Aktivitas Sales

Mencatat aktivitas yang dilakukan untuk setiap opportunity.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `opp_id` | UUID | FK → `opportunities(id)` ON DELETE CASCADE | NULL | Relasi ke opportunity |
| `type` | VARCHAR(50) | NOT NULL | — | Tipe aktivitas (call, email, meeting, dll) |
| `description` | TEXT | — | NULL | Deskripsi aktivitas |
| `created_by` | UUID | FK → `users(id)` | NULL | User yang melakukan aktivitas |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp aktivitas |

> **Catatan:** `ON DELETE CASCADE` — jika opportunity dihapus, semua
> activities terkait ikut dihapus.

### 2.7 `tasks` — Follow-up Tasks

Task/tindak lanjut yang perlu dilakukan untuk setiap opportunity.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `opp_id` | UUID | FK → `opportunities(id)` ON DELETE CASCADE | NULL | Relasi ke opportunity |
| `title` | VARCHAR(255) | NOT NULL | — | Judul task |
| `due_date` | DATE | — | NULL | Tanggal jatuh tempo |
| `status` | VARCHAR(20) | — | `'open'` | Status: open, in_progress, done, cancelled |
| `assigned_to` | UUID | FK → `users(id)` | NULL | User yang ditugaskan |
| `created_at` | TIMESTAMP | — | `NOW()` | Timestamp pembuatan |

> **Catatan:** `ON DELETE CASCADE` — jika opportunity dihapus, semua
> tasks terkait ikut dihapus.

### 2.8 `agent_logs` — Audit Trail AI Agent

Mencatat setiap aksi yang dilakukan oleh AI Agent untuk audit dan debugging.

| Kolom | Tipe | Constraint | Default | Keterangan |
|-------|------|-----------|---------|------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Identifier unik |
| `agent_type` | VARCHAR(50) | NOT NULL | — | Tipe agent: opportunity, pipeline, insight |
| `action` | VARCHAR(100) | NOT NULL | — | Nama aksi yang dijalankan |
| `input` | JSONB | — | NULL | Input yang diberikan ke agent |
| `output` | JSONB | — | NULL | Output yang dihasilkan agent |
| `token_usage` | INT | — | `0` | Jumlah token LLM yang digunakan |
| `status` | VARCHAR(20) | — | `'success'` | Status eksekusi: success, error, partial |
| `timestamp` | TIMESTAMP | — | `NOW()` | Timestamp eksekusi |

> **Catatan:** Tabel ini adalah sumber kebenaran untuk audit trail AI Agent.
> Setiap panggilan LLM (Opportunity Agent, Pipeline Agent, Insight Agent)
> dicatat di sini.

---

## 3. Default Stages

Tabel `stages` di-seed dengan 6 stage default saat inisialisasi database:

| Order | Name | Probability | is_closed | is_won | Keterangan |
|-------|------|-------------|-----------|--------|------------|
| 1 | Prospecting | 0.10 | false | false | Identifikasi lead awal |
| 2 | Qualification | 0.25 | false | false | Kualifikasi kebutuhan & BANT |
| 3 | Proposal | 0.50 | false | false | Proposal/solution dikirim |
| 4 | Negotiation | 0.70 | false | false | Negosiasi harga & terms |
| 5 | Closed Won | 1.00 | true | true | Deal berhasil dimenangkan |
| 6 | Closed Lost | 0.00 | true | false | Deal gagal/dihilangkan |

```sql
INSERT INTO stages (name, "order", probability, is_closed, is_won) VALUES
    ('Prospecting',  1, 0.10, FALSE, FALSE),
    ('Qualification', 2, 0.25, FALSE, FALSE),
    ('Proposal',      3, 0.50, FALSE, FALSE),
    ('Negotiation',   4, 0.70, FALSE, FALSE),
    ('Closed Won',    5, 1.00, TRUE,  TRUE),
    ('Closed Lost',   6, 0.00, TRUE,  FALSE)
ON CONFLICT DO NOTHING;
```

---

## 4. Indexes

Index yang dibuat untuk optimasi query performance:

| Nama Index | Tabel | Kolom | Tipe Index | Keterangan |
|------------|-------|-------|-----------|------------|
| `idx_opp_stage` | opportunities | `stage_id` | B-tree | Filter deal berdasarkan stage (pipeline view) |
| `idx_opp_owner` | opportunities | `owner_id` | B-tree | Filter deal berdasarkan sales rep (rep performance) |
| `idx_opp_close_date` | opportunities | `close_date` | B-tree | Filter deal berdasarkan target close (forecast) |
| `idx_opp_embedding` | opportunities | `embedding` | ivfflat (vector_cosine_ops, lists=100) | Semantic search via cosine similarity |
| `idx_activities_opp` | activities | `opp_id` | B-tree | Fetch activities untuk opportunity tertentu |
| `idx_agent_logs_type` | agent_logs | `(agent_type, timestamp)` | B-tree (composite) | Filter log berdasarkan tipe agent & waktu |

### Index pgvector (ivfflat)

```sql
CREATE INDEX IF NOT EXISTS idx_opp_embedding
    ON opportunities
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

> **Catatan tentang `lists = 100`:**
> - Parameter `lists` menentukan jumlah cluster untuk algoritma
>   Inverted File Flat (IVFFlat) — approximate nearest neighbor (ANN).
> - `lists = 100` optimal untuk dataset skala menengah (ribuan hingga
>   puluhan ribu vektor).
> - Rule of thumb: `lists ≈ sqrt(rows)` untuk dataset awal.
> - Index harus di-rebuild setelah data signifikan ditambahkan:
>   `REINDEX INDEX idx_opp_embedding;`
> - Operator class `vector_cosine_ops` mendukung operasi
>   `<=>` (cosine distance) dan `<->` (L2 distance).

---

## 5. Materialized Views

Tiga materialized views untuk pre-aggregate data yang sering di-query
oleh dashboard dan analytics (dapat juga dikonsumsi oleh Tableau atau BI tool).

### 5.1 `mv_funnel_summary` — Ringkasan Funnel per Stage

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funnel_summary AS
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
```

| Kolom | Tipe | Sumber | Keterangan |
|-------|------|--------|------------|
| `stage_name` | VARCHAR | stages.name | Nama stage |
| `stage_order` | INT | stages.order | Urutan stage |
| `deal_count` | BIGINT | COUNT(opportunities.id) | Jumlah deal per stage |
| `total_value` | NUMERIC | SUM(opportunities.value) | Total nilai deal per stage |
| `avg_win_prob` | FLOAT | AVG(win_probability) | Rata-rata probabilitas win |
| `month` | TIMESTAMP | DATE_TRUNC('month', created_at) | Bulan aggregasi |

### 5.2 `mv_forecast_data` — Data Forecast per Bulan

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_forecast_data AS
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
```

| Kolom | Tipe | Sumber | Keterangan |
|-------|------|--------|------------|
| `close_month` | TIMESTAMP | DATE_TRUNC('month', close_date) | Bulan target close |
| `weighted_pipeline` | NUMERIC | SUM(value × win_probability) | Pipeline dengan bobot probabilitas |
| `unweighted_pipeline` | NUMERIC | SUM(value) | Pipeline tanpa bobot |
| `deal_count` | BIGINT | COUNT(id) | Jumlah deal |
| `avg_probability` | FLOAT | AVG(win_probability) | Rata-rata probabilitas |

> **Filter:** Hanya opportunity dengan stage yang `is_closed = FALSE`
> (deal yang masih aktif/belum ditutup).

### 5.3 `mv_rep_performance` — Performance Sales Rep

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rep_performance AS
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

| Kolom | Tipe | Sumber | Keterangan |
|-------|------|--------|------------|
| `rep_id` | UUID | users.id | ID sales rep |
| `rep_name` | VARCHAR | users.name | Nama sales rep |
| `total_deals` | BIGINT | COUNT(opportunities.id) | Total deal yang dimiliki |
| `won_deals` | BIGINT | COUNT(CASE WHEN is_won) | Jumlah deal yang won |
| `won_revenue` | NUMERIC | SUM(value WHERE is_won) | Total revenue dari deal won |
| `avg_deal_size` | NUMERIC | AVG(value) | Rata-rata nilai deal |
| `quota` | DECIMAL | users.quota | Target quota sales rep |

> **Filter:** Hanya user dengan `role = 'sales_rep'`.

### Refresh Materialized Views

```sql
-- Refresh semua materialized views (non-concurrent)
REFRESH MATERIALIZED VIEW mv_funnel_summary;
REFRESH MATERIALIZED VIEW mv_forecast_data;
REFRESH MATERIALIZED VIEW mv_rep_performance;

-- Jika view mendukung concurrent refresh (memerlukan unique index):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_summary;
```

> **Rekomendasi:** Refresh secara periodik (hourly/daily) via Celery task
> atau cron job untuk menjaga data tetap up-to-date.

---

## 6. ERD (Entity Relationship Diagram)

```
┌──────────────────┐         ┌──────────────────┐
│     accounts      │         │     contacts     │
│──────────────────│         │──────────────────│
│ PK  id (UUID)    │ 1───∞ ──│ FK  account_id   │
│     name         │         │ PK  id (UUID)    │
│     industry     │         │     name         │
│     website      │         │     email        │
│     size         │         │     phone        │
│     region       │         │     role         │
│     created_at   │         │     created_at   │
│     updated_at   │         └────────┬─────────┘
└────────┬─────────┘                  │
         │                            │
         │ 1                        1│
         │                            │
         │∞                           │∞
         │                            │
         ▼                            ▼
┌──────────────────────────────────────────────────┐
│                  opportunities                    │
│──────────────────────────────────────────────────│
│ PK  id (UUID)                                    │
│ FK  account_id  ──────────► accounts.id           │
│ FK  contact_id  ──────────► contacts.id          │
│ FK  stage_id    ──────────► stages.id             │
│ FK  owner_id    ──────────► users.id             │
│     name                                          │
│     value (DECIMAL 15,2)                          │
│     currency DEFAULT 'IDR'                        │
│     close_date                                    │
│     win_probability DEFAULT 0.0                   │
│     source                                        │
│     ai_metadata (JSONB)                           │
│     embedding (vector 1024)                       │
│     created_at                                    │
│     updated_at                                    │
└──────┬──────────────┬────────────────────────────┘
       │              │
       │1             │1
       │              │
       │∞             │∞
       ▼              ▼
┌──────────────┐  ┌──────────────┐
│  activities   │  │    tasks      │
│──────────────│  │──────────────│
│ PK id (UUID) │  │ PK id (UUID) │
│ FK opp_id    │  │ FK opp_id    │
│    ON DELETE │  │    ON DELETE │
│    CASCADE   │  │    CASCADE   │
│ FK created_by│  │ FK assigned_to│
│   ► users.id │  │   ► users.id │
│    type      │  │    title     │
│    description│  │    due_date  │
│    created_at│  │    status    │
└──────────────┘  │    created_at│
                  └──────────────┘

┌──────────────────┐         ┌──────────────────┐
│      stages       │         │      users       │
│──────────────────│         │──────────────────│
│ PK  id (UUID)    │         │ PK  id (UUID)    │
│     name         │         │     name         │
│     order        │ 1───∞ ──│     email UNIQUE │
│     probability  │  (stage)│     role DEFAULT │
│     is_closed    │         │       'sales_rep'│
│     is_won       │         │     quota        │
└──────────────────┘         │     created_at   │
                             └────────┬─────────┘
                                      │
                               1──────┼──────1──────1
                               │      │      │
                              ∞│     ∞│     ∞│
                          (owner) (created_by) (assigned_to)
                               │      │      │
                               ▼      ▼      ▼
                    opportunities  activities  tasks

┌──────────────────────────────────┐
│           agent_logs              │
│──────────────────────────────────│
│ PK  id (UUID)                    │
│     agent_type (opportunity/     │
│       pipeline/insight)           │
│     action                       │
│     input (JSONB)                │
│     output (JSONB)               │
│     token_usage DEFAULT 0        │
│     status DEFAULT 'success'     │
│     timestamp                    │
└──────────────────────────────────┘
   (Standalone — no FK relationships)
```

---

## 7. Ringkasan Relasi

### Foreign Key Relationships

| Dari (Child) | Kolom FK | Ke (Parent) | On Delete | Kardinalitas |
|-------------|----------|-------------|-----------|-------------|
| `contacts` | `account_id` | `accounts.id` | CASCADE | accounts 1 ── ∞ contacts |
| `opportunities` | `account_id` | `accounts.id` | (RESTRICT) | accounts 1 ── ∞ opportunities |
| `opportunities` | `contact_id` | `contacts.id` | (RESTRICT) | contacts 1 ── ∞ opportunities |
| `opportunities` | `stage_id` | `stages.id` | (RESTRICT) | stages 1 ── ∞ opportunities |
| `opportunities` | `owner_id` | `users.id` | (RESTRICT) | users 1 ── ∞ opportunities (as owner) |
| `activities` | `opp_id` | `opportunities.id` | CASCADE | opportunities 1 ── ∞ activities |
| `activities` | `created_by` | `users.id` | (RESTRICT) | users 1 ── ∞ activities (as created_by) |
| `tasks` | `opp_id` | `opportunities.id` | CASCADE | opportunities 1 ── ∞ tasks |
| `tasks` | `assigned_to` | `users.id` | (RESTRICT) | users 1 ── ∞ tasks (as assigned_to) |

### Relasi Diagram (Ringkas)

```
accounts 1───────∞ contacts
    │
    └─────────────∞ opportunities
                       │
contacts 1─────────────┘
                       │
stages 1───────────────┤
                       │
users 1────────────────┤ (as owner)
    │                  │
    │                  1
    │                  │
    │                  ∞
    ├──────────────── activities (as created_by)
    │                  │
    │              opportunities 1───∞ activities (CASCADE)
    │                  │
    │              opportunities 1───∞ tasks (CASCADE)
    │                  │
    └──────────────── tasks (as assigned_to)

agent_logs (standalone — tidak punya FK)
```

### Cascade Delete Rules

| Parent | Child | Behavior |
|--------|-------|----------|
| `accounts` | `contacts` | DELETE account → contacts ikut dihapus |
| `opportunities` | `activities` | DELETE opportunity → activities ikut dihapus |
| `opportunities` | `tasks` | DELETE opportunity → tasks ikut dihapus |

> **Catatan:** Relasi lain (opportunities → accounts/contacts/stages/users,
> activities → users, tasks → users) menggunakan default behavior PostgreSQL
> yaitu `NO ACTION` (RESTRICT) — tidak bisa delete parent jika masih ada
> child yang mereferensikan.

### Tabel Mandiri (Standalone)

| Tabel | FK Relationships | Keterangan |
|-------|-----------------|------------|
| `agent_logs` | Tidak ada | Audit trail AI Agent, tidak terikat ke tabel lain |

---

## Lampiran: Quick Reference — Semua Tabel

```
┌─────────────┬─────────────────────────────────────────────────────────────┐
│  Tabel       │  Kolom Utama                                                │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ accounts    │ id, name, industry, website, size, region,                  │
│              │ created_at, updated_at                                      │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ contacts    │ id, account_id(FK CASCADE), name, email, phone, role,     │
│              │ created_at                                                  │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ stages      │ id, name, order, probability, is_closed, is_won             │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ users       │ id, name, email(UNIQUE), role('sales_rep'), quota,        │
│              │ created_at                                                  │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ opportunities│ id, account_id(FK), contact_id(FK), name, stage_id(FK),  │
│              │ value(15,2), currency('IDR'), close_date,                 │
│              │ win_probability(0.0), owner_id(FK), source,                │
│              │ ai_metadata(JSONB), embedding(vector 1024),               │
│              │ created_at, updated_at                                      │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ activities  │ id, opp_id(FK CASCADE), type, description(TEXT),          │
│              │ created_by(FK), created_at                                  │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ tasks       │ id, opp_id(FK CASCADE), title, due_date, status('open'),   │
│              │ assigned_to(FK), created_at                                 │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ agent_logs  │ id, agent_type, action, input(JSONB), output(JSONB),       │
│              │ token_usage(0), status('success'), timestamp              │
└─────────────┴─────────────────────────────────────────────────────────────┘
```

---

*Dokumen ini bersifat living document. Skema database dapat berevolusi
seiring penambahan fitur. Untuk definisi SQL terbaru, selalu rujuk
`backend/app/db/init.sql`.*
