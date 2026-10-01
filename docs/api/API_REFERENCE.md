# API Reference — RenRND Sales Agentic AI

> Dokumentasi referensi API untuk aplikasi **RenRND Sales Agentic AI**.
> Versi API: `v1` | Versi Aplikasi: `1.0.0`

| Item | Nilai |
|------|-------|
| **Base URL** | `http://localhost:8000/api/v1` |
| **Swagger UI** | `http://localhost:8000/docs` |
| **ReDoc** | `http://localhost:8000/redoc` |
| **OpenAPI Schema** | `http://localhost:8000/openapi.json` |
| **Root Endpoint** | `GET http://localhost:8000/` |
| **Content-Type** | `application/json` |
| **Charset** | `UTF-8` |

---

## Daftar Isi

- [1. Pengantar](#1-pengantar)
  - [1.1 Konvensi Umum](#11-konvensi-umum)
  - [1.2 Tipe Data](#12-tipe-data)
  - [1.3 Penanganan Error](#13-penanganan-error)
- [2. Health Check](#2-health-check)
  - [2.1 GET /health](#21-get-health)
  - [2.2 GET / (Root)](#22-get--root)
- [3. Stages (Tahapan Pipeline)](#3-stages-tahapan-pipeline)
  - [3.1 GET /stages](#31-get-stages)
- [4. Opportunities (Peluang)](#4-opportunities-peluang)
  - [4.1 GET /opportunities](#41-get-opportunities)
  - [4.2 POST /opportunities](#42-post-opportunities)
  - [4.3 GET /opportunities/{opp_id}](#43-get-opportunitiesopp_id)
  - [4.4 PATCH /opportunities/{opp_id}](#44-patch-opportunitiesopp_id)
  - [4.5 DELETE /opportunities/{opp_id}](#45-delete-opportunitiesopp_id)
- [5. Activities (Aktivitas)](#5-activities-aktivitas)
  - [5.1 GET /activities](#51-get-activities)
  - [5.2 POST /activities](#52-post-activities)
  - [5.3 DELETE /activities/{activity_id}](#53-delete-activitiesactivity_id)
- [6. Tasks (Tugas/Follow-up)](#6-tasks-tugasfollow-up)
  - [6.1 GET /tasks](#61-get-tasks)
  - [6.2 POST /tasks](#62-post-tasks)
  - [6.3 PATCH /tasks/{task_id}](#63-patch-taskstask_id)
  - [6.4 DELETE /tasks/{task_id}](#64-delete-taskstask_id)
- [7. Accounts & Contacts (Akun & Kontak)](#7-accounts--contacts-akun--kontak)
  - [7.1 GET /accounts](#71-get-accounts)
  - [7.2 POST /accounts](#72-post-accounts)
  - [7.3 GET /accounts/{account_id}/contacts](#73-get-accountsaccount_idcontacts)
  - [7.4 POST /accounts/contacts](#74-post-accountscontacts)
- [8. Users (Pengguna / Sales Rep)](#8-users-pengguna--sales-rep)
- [9. Dashboard](#9-dashboard)
  - [9.1 GET /dashboard/summary](#91-get-dashboardsummary)
  - [9.2 GET /dashboard/forecast](#92-get-dashboardforecast)
  - [9.3 GET /dashboard/rep-performance](#93-get-dashboardrep-performance)
- [10. AI Agents (Agen AI)](#10-ai-agents-agen-ai)
  - [10.1 POST /agents/opportunity/run](#101-post-agentsopportunityrun)
  - [10.2 POST /agents/pipeline/scan](#102-post-agentspipelinescan)
  - [10.3 GET /agents/insight/briefing](#103-get-agentsinsightbriefing)
- [11. Referensi Skema Data](#11-referensi-skema-data)
- [12. Tabel Stages Default](#12-tabel-stages-default)
- [13. Lampiran](#13-lampiran)

---

## 1. Pengantar

**RenRND Sales Agentic AI** adalah platform manajemen penjualan (sales pipeline) yang ditenagai oleh agen AI. API ini dibangun menggunakan **FastAPI** (Python) dengan database **PostgreSQL** (mendukung `pgvector` untuk pencarian semantik) dan terintegrasi dengan LLM **BytePlus ModelArk** (Skylark-lite & Skylark-pro).

Aplikasi menyediakan tiga lapisan fungsionalitas utama:

1. **CRUD Data Sales** — Opportunities, Activities, Tasks, Accounts, Contacts.
2. **Dashboard & Analytics** — Ringkasan pipeline, forecast berbobot, dan performa sales rep.
3. **AI Agents** — Opportunity Agent (deteksi & pembuatan peluang otomatis), Pipeline Agent (evaluasi & rekomendasi), dan Insight Agent (daily briefing).

### 1.1 Konvensi Umum

- Semua endpoint bertag REST dan menggunakan format JSON untuk request maupun response.
- Semua endpoint CRUD berada di bawah prefix `/api/v1`.
- Endpoint `GET /health` dan `GET /` berada di root (tanpa prefix `/api/v1`).
- Pengidentifikasi entitas menggunakan **UUID v4** (format string, contoh: `"550e8400-e29b-41d4-a716-446655440000"`).
- Format tanggal: `YYYY-MM-DD` (ISO 8601 date).
- Format timestamp: ISO 8601 datetime dengan zona UTC (contoh: `"2026-09-28T07:30:00"`).
- Nilai mata uang menggunakan `float` / `DECIMAL(15,2)`. Mata uang default adalah `IDR` (Rupiah).
- Probabilitas (`win_probability`) bernilai `0.0` sampai `1.0`.
- CORS diizinkan untuk origin `http://localhost:3000` (frontend Next.js).

### 1.2 Tipe Data

| Tipe | Deskripsi | Contoh |
|------|-----------|--------|
| `UUID` | Pengidentifikasi unik (UUID v4) | `"550e8400-e29b-41d4-a716-446655440000"` |
| `string` | Teks | `"PT Maju Jaya Teknologi"` |
| `int` | Bilangan bulat | `100` |
| `float` | Bilangan desimal | `250000000.0` |
| `bool` | Boolean | `true` / `false` |
| `date` | Tanggal ISO 8601 | `"2026-10-28"` |
| `datetime` | Timestamp ISO 8601 | `"2026-09-28T07:30:00"` |
| `object`/`JSONB` | Objek JSON | `{"key": "value"}` |
| `array` | Daftar/Array | `[...]` |

### 1.3 Penanganan Error

API mengembalikan error dalam format standar FastAPI (HTTPException). Response error selalu mengandung field `detail`.

**Format Response Error:**

```json
{
  "detail": "Opportunity not found"
}
```

**Daftar Kode Status Umum:**

| Kode Status | Deskripsi |
|-------------|-----------|
| `200 OK` | Permintaan berhasil (GET, PATCH). |
| `201 Created` | Sumber daya berhasil dibuat (POST). |
| `204 No Content` | Sumber daya berhasil dihapus (DELETE). Tidak ada body response. |
| `404 Not Found` | Sumber daya tidak ditemukan. |
| `422 Unprocessable Entity` | Validasi input gagal (body/parameter tidak valid). |
| `4xx` | Error klien lainnya. |
| `5xx` | Error server (mis. koneksi database/LLM bermasalah). |

**Contoh Response 422 (Validation Error):**

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

---

## 2. Health Check

Endpoint untuk memantau status aplikasi. Endpoint ini berada di **root** aplikasi (tanpa prefix `/api/v1`).

### 2.1 GET /health

Memeriksa status kesehatan aplikasi.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/health` |
| **Full URL** | `http://localhost:8000/health` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):**

```json
{
  "status": "healthy"
}
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/health
```

---

### 2.2 GET / (Root)

Mengembalikan metadata dasar aplikasi.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/` |
| **Full URL** | `http://localhost:8000/` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):**

```json
{
  "app": "RenRND Sales Agentic AI",
  "status": "running",
  "version": "1.0.0"
}
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/
```

---

## 3. Stages (Tahapan Pipeline)

Endpoint untuk melihat daftar tahapan (stages) pipeline penjualan. Stage merepresentasikan posisi sebuah deal dalam funnel penjualan, masing-masing memiliki probabilitas menang default.

### 3.1 GET /stages

Mengambil daftar seluruh stage pipeline, diurutkan berdasarkan `order` (ascending).

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/stages` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):** Array of `StageResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik stage |
| `name` | `string` | Nama stage |
| `order` | `int` | Urutan stage dalam pipeline (1 = paling awal) |
| `probability` | `float` | Probabilitas menang default untuk stage ini (0.0–1.0) |
| `is_closed` | `bool` | `true` jika stage adalah tahap akhir (closed) |
| `is_won` | `bool` | `true` jika stage merepresentasikan deal yang dimenangkan |

**Contoh Response:**

```json
[
  {
    "id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "Prospecting",
    "order": 1,
    "probability": 0.10,
    "is_closed": false,
    "is_won": false
  },
  {
    "id": "a1b2c3d4-0001-4000-8000-000000000002",
    "name": "Qualification",
    "order": 2,
    "probability": 0.25,
    "is_closed": false,
    "is_won": false
  },
  {
    "id": "a1b2c3d4-0001-4000-8000-000000000005",
    "name": "Closed Won",
    "order": 5,
    "probability": 1.00,
    "is_closed": true,
    "is_won": true
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/stages
```

---

## 4. Opportunities (Peluang)

Opportunity (peluang) adalah inti dari pipeline penjualan — merepresentasikan sebuah deal potensial dengan nilai, mata uang, stage, tanggal tutup, probabilitas menang, pemilik (owner), dan sumber.

### 4.1 GET /opportunities

Mengambil daftar opportunity, diurutkan berdasarkan `created_at` menurun (terbaru lebih dulu).

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/opportunities` |
| **Auth** | Tidak diperlukan |

**Query Parameters:**

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `skip` | `int` | `0` | Jumlah record yang dilewati (pagination offset) |
| `limit` | `int` | `100` | Jumlah maksimum record yang dikembalikan |

**Response Body (200):** Array of `OpportunityResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik opportunity |
| `account_id` | `UUID \| null` | ID akun (perusahaan customer) terkait |
| `name` | `string` | Nama/nama deal opportunity |
| `stage_id` | `UUID \| null` | ID stage pipeline saat ini |
| `value` | `float` | Nilai deal (dalam mata uang `currency`) |
| `currency` | `string` | Kode mata uang (3 huruf), default `IDR` |
| `close_date` | `date \| null` | Tanggal perkiraan tutup deal |
| `win_probability` | `float` | Probabilitas menang (0.0–1.0) |
| `owner_id` | `UUID \| null` | ID sales rep pemilik deal |
| `source` | `string \| null` | Sumber lead (mis. `ai_agent`, `inbound`, `referral`) |
| `ai_metadata` | `object \| null` | Metadata tambahan hasil analisis AI (JSONB) |
| `created_at` | `datetime` | Timestamp pembuatan |
| `updated_at` | `datetime` | Timestamp pembaruan terakhir |

**Contoh Response:**

```json
[
  {
    "id": "b2c3d4e5-1234-4000-8000-000000000001",
    "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "PT Maju Jaya Teknologi - Sistem CRM Enterprise",
    "stage_id": "a1b2c3d4-0001-4000-8000-000000000001",
    "value": 250000000.0,
    "currency": "IDR",
    "close_date": "2026-10-28",
    "win_probability": 0.10,
    "owner_id": "c3d4e5f6-0001-4000-8000-000000000001",
    "source": "ai_agent",
    "ai_metadata": null,
    "created_at": "2026-09-28T07:30:00",
    "updated_at": "2026-09-28T07:30:00"
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
# Ambil 10 opportunity pertama
curl -X GET "http://localhost:8000/api/v1/opportunities?skip=0&limit=10"
```

---

### 4.2 POST /opportunities

Membuat opportunity baru.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/opportunities` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `OpportunityCreate` (JSON) |

**Request Body (`OpportunityCreate`):**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `account_id` | `UUID` | Tidak | `null` | ID akun terkait |
| `name` | `string` | **Ya** | — | Nama opportunity/deal |
| `stage_id` | `UUID` | Tidak | `null` | ID stage awal |
| `value` | `float` | **Ya** | — | Nilai deal |
| `currency` | `string` | Tidak | `IDR` | Kode mata uang (3 huruf) |
| `close_date` | `date` | Tidak | `null` | Tanggal perkiraan tutup |
| `owner_id` | `UUID` | Tidak | `null` | ID sales rep pemilik |
| `source` | `string` | Tidak | `null` | Sumber lead |

**Contoh Request Body:**

```json
{
  "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
  "name": "PT Maju Jaya Teknologi - Cloud Migration",
  "stage_id": "a1b2c3d4-0001-4000-8000-000000000001",
  "value": 300000000,
  "currency": "IDR",
  "close_date": "2026-11-15",
  "owner_id": "c3d4e5f6-0001-4000-8000-000000000001",
  "source": "ai_agent"
}
```

**Response Body (201):** `OpportunityResponse` (lihat struktur pada [4.1](#41-get-opportunities)).

**Contoh Response:**

```json
{
  "id": "b2c3d4e5-1234-4000-8000-000000000099",
  "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
  "name": "PT Maju Jaya Teknologi - Cloud Migration",
  "stage_id": "a1b2c3d4-0001-4000-8000-000000000001",
  "value": 300000000.0,
  "currency": "IDR",
  "close_date": "2026-11-15",
  "win_probability": 0.0,
  "owner_id": "c3d4e5f6-0001-4000-8000-000000000001",
  "source": "ai_agent",
  "ai_metadata": null,
  "created_at": "2026-09-28T07:35:00",
  "updated_at": "2026-09-28T07:35:00"
}
```

**Status Codes:** `201 Created`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/opportunities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PT Maju Jaya Teknologi - Cloud Migration",
    "value": 300000000,
    "currency": "IDR",
    "close_date": "2026-11-15",
    "source": "ai_agent"
  }'
```

---

### 4.3 GET /opportunities/{opp_id}

Mengambil detail satu opportunity berdasarkan ID.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/opportunities/{opp_id}` |
| **Auth** | Tidak diperlukan |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `opp_id` | `UUID` | ID opportunity |

**Response Body (200):** `OpportunityResponse` (lihat [4.1](#41-get-opportunities)).

**Status Codes:** `200 OK`, `404 Not Found`

**Contoh Response Error (404):**

```json
{
  "detail": "Opportunity not found"
}
```

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/opportunities/b2c3d4e5-1234-4000-8000-000000000001
```

---

### 4.4 PATCH /opportunities/{opp_id}

Memperbarui sebagian field opportunity. Hanya field yang dikirim yang akan diperbarui (partial update).

| Item | Nilai |
|------|-------|
| **Method** | `PATCH` |
| **Path** | `/api/v1/opportunities/{opp_id}` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `OpportunityUpdate` (JSON) |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `opp_id` | `UUID` | ID opportunity |

**Request Body (`OpportunityUpdate`)** — semua field opsional:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `name` | `string` | Nama opportunity |
| `stage_id` | `UUID` | ID stage baru |
| `value` | `float` | Nilai deal |
| `close_date` | `date` | Tanggal perkiraan tutup |
| `win_probability` | `float` | Probabilitas menang (0.0–1.0) |
| `owner_id` | `UUID` | ID sales rep pemilik |

**Contoh Request Body:**

```json
{
  "stage_id": "a1b2c3d4-0001-4000-8000-000000000003",
  "win_probability": 0.5,
  "close_date": "2026-12-01"
}
```

**Response Body (200):** `OpportunityResponse` dengan field yang diperbarui.

**Status Codes:** `200 OK`, `404 Not Found`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X PATCH http://localhost:8000/api/v1/opportunities/b2c3d4e5-1234-4000-8000-000000000001 \
  -H "Content-Type: application/json" \
  -d '{
    "stage_id": "a1b2c3d4-0001-4000-8000-000000000003",
    "win_probability": 0.5
  }'
```

---

### 4.5 DELETE /opportunities/{opp_id}

Menghapus opportunity berdasarkan ID. Penghapusan akan **berkaskade (cascade)** ke `activities` dan `tasks` yang terkait opportunity ini.

| Item | Nilai |
|------|-------|
| **Method** | `DELETE` |
| **Path** | `/api/v1/opportunities/{opp_id}` |
| **Auth** | Tidak diperlukan |
| **Request Body** | — |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `opp_id` | `UUID` | ID opportunity |

**Response Body:** Tidak ada (204 No Content).

**Status Codes:** `204 No Content`, `404 Not Found`

**Contoh cURL:**

```bash
curl -X DELETE http://localhost:8000/api/v1/opportunities/b2c3d4e5-1234-4000-8000-000000000001
```

---

## 5. Activities (Aktivitas)

Activity merepresentasikan log aktivitas penjualan (call, email, meeting, note) yang terkait dengan sebuah opportunity.

### 5.1 GET /activities

Mengambil daftar aktivitas, diurutkan berdasarkan `created_at` menurun. Dapat difilter berdasarkan opportunity.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/activities` |
| **Auth** | Tidak diperlukan |

**Query Parameters:**

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `opp_id` | `UUID` | `null` | Filter aktivitas berdasarkan ID opportunity |

**Response Body (200):** Array of `ActivityResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik aktivitas |
| `opp_id` | `UUID` | ID opportunity terkait |
| `type` | `string` | Tipe aktivitas (mis. `call`, `email`, `meeting`, `note`) |
| `description` | `string \| null` | Deskripsi aktivitas |
| `created_by` | `UUID \| null` | ID user pembuat aktivitas |
| `created_at` | `datetime` | Timestamp pembuatan |

**Contoh Response:**

```json
[
  {
    "id": "d4e5f6a7-1234-4000-8000-000000000001",
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
    "type": "call",
    "description": "Initial discovery call dengan prospect, diskusi kebutuhan CRM",
    "created_by": "c3d4e5f6-0001-4000-8000-000000000001",
    "created_at": "2026-09-28T07:30:00"
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
# Filter berdasarkan opportunity
curl -X GET "http://localhost:8000/api/v1/activities?opp_id=b2c3d4e5-1234-4000-8000-000000000001"

# Ambil semua aktivitas
curl -X GET http://localhost:8000/api/v1/activities
```

---

### 5.2 POST /activities

Membuat aktivitas baru untuk sebuah opportunity.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/activities` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `ActivityCreate` (JSON) |

**Request Body (`ActivityCreate`):**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `opp_id` | `UUID` | **Ya** | — | ID opportunity terkait |
| `type` | `string` | **Ya** | — | Tipe aktivitas (`call`, `email`, `meeting`, `note`) |
| `description` | `string` | Tidak | `null` | Deskripsi aktivitas |
| `created_by` | `UUID` | Tidak | `null` | ID user pembuat |

**Contoh Request Body:**

```json
{
  "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
  "type": "meeting",
  "description": "On-site meeting dengan CTO untuk demo sistem",
  "created_by": "c3d4e5f6-0001-4000-8000-000000000001"
}
```

**Response Body (201):** `ActivityResponse`

**Contoh Response:**

```json
{
  "id": "d4e5f6a7-1234-4000-8000-000000000099",
  "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
  "type": "meeting",
  "description": "On-site meeting dengan CTO untuk demo sistem",
  "created_by": "c3d4e5f6-0001-4000-8000-000000000001",
  "created_at": "2026-09-28T08:00:00"
}
```

**Status Codes:** `201 Created`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/activities \
  -H "Content-Type: application/json" \
  -d '{
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
    "type": "meeting",
    "description": "On-site meeting dengan CTO untuk demo sistem"
  }'
```

---

### 5.3 DELETE /activities/{activity_id}

Menghapus aktivitas berdasarkan ID.

| Item | Nilai |
|------|-------|
| **Method** | `DELETE` |
| **Path** | `/api/v1/activities/{activity_id}` |
| **Auth** | Tidak diperlukan |
| **Request Body** | — |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `activity_id` | `UUID` | ID aktivitas |

**Response Body:** Tidak ada (204 No Content).

**Status Codes:** `204 No Content`, `404 Not Found`

**Contoh cURL:**

```bash
curl -X DELETE http://localhost:8000/api/v1/activities/d4e5f6a7-1234-4000-8000-000000000001
```

---

## 6. Tasks (Tugas/Follow-up)

Task merepresentasikan tugas follow-up yang terkait dengan sebuah opportunity, dengan tenggat waktu dan status.

### 6.1 GET /tasks

Mengambil daftar tugas, diurutkan berdasarkan `created_at` menurun. Dapat difilter berdasarkan opportunity dan/atau status.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/tasks` |
| **Auth** | Tidak diperlukan |

**Query Parameters:**

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `opp_id` | `UUID` | `null` | Filter tugas berdasarkan ID opportunity |
| `status` | `string` | `null` | Filter berdasarkan status (`open` atau `done`) |

**Response Body (200):** Array of `TaskResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik tugas |
| `opp_id` | `UUID` | ID opportunity terkait |
| `title` | `string` | Judul tugas |
| `due_date` | `date \| null` | Tenggat waktu tugas |
| `status` | `string` | Status tugas (`open` atau `done`) |
| `assigned_to` | `UUID \| null` | ID user yang ditugaskan |
| `created_at` | `datetime` | Timestamp pembuatan |

**Contoh Response:**

```json
[
  {
    "id": "e5f6a7b8-1234-4000-8000-000000000001",
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
    "title": "Follow up call dengan decision maker",
    "due_date": "2026-10-01",
    "status": "open",
    "assigned_to": "c3d4e5f6-0001-4000-8000-000000000001",
    "created_at": "2026-09-28T07:30:00"
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
# Filter berdasarkan opportunity dan status
curl -X GET "http://localhost:8000/api/v1/tasks?opp_id=b2c3d4e5-1234-4000-8000-000000000001&status=open"

# Ambil semua tugas berstatus done
curl -X GET "http://localhost:8000/api/v1/tasks?status=done"
```

---

### 6.2 POST /tasks

Membuat tugas follow-up baru.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/tasks` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `TaskCreate` (JSON) |

**Request Body (`TaskCreate`):**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `opp_id` | `UUID` | **Ya** | — | ID opportunity terkait |
| `title` | `string` | **Ya** | — | Judul tugas |
| `due_date` | `date` | Tidak | `null` | Tenggat waktu |
| `assigned_to` | `UUID` | Tidak | `null` | ID user yang ditugaskan |

**Contoh Request Body:**

```json
{
  "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
  "title": "Kirim proposal formal",
  "due_date": "2026-10-03",
  "assigned_to": "c3d4e5f6-0001-4000-8000-000000000001"
}
```

**Response Body (201):** `TaskResponse` (status default `open`).

**Contoh Response:**

```json
{
  "id": "e5f6a7b8-1234-4000-8000-000000000099",
  "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
  "title": "Kirim proposal formal",
  "due_date": "2026-10-03",
  "status": "open",
  "assigned_to": "c3d4e5f6-0001-4000-8000-000000000001",
  "created_at": "2026-09-28T08:05:00"
}
```

**Status Codes:** `201 Created`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
    "title": "Kirim proposal formal",
    "due_date": "2026-10-03"
  }'
```

---

### 6.3 PATCH /tasks/{task_id}

Memperbarui sebagian field tugas (mis. menandai selesai atau mengubah tenggat).

| Item | Nilai |
|------|-------|
| **Method** | `PATCH` |
| **Path** | `/api/v1/tasks/{task_id}` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `TaskUpdate` (JSON) |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `task_id` | `UUID` | ID tugas |

**Request Body (`TaskUpdate`)** — semua field opsional:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `title` | `string` | Judul tugas |
| `due_date` | `date` | Tenggat waktu |
| `status` | `string` | Status tugas (`open` atau `done`) |

**Contoh Request Body:**

```json
{
  "status": "done"
}
```

**Response Body (200):** `TaskResponse` dengan field yang diperbarui.

**Status Codes:** `200 OK`, `404 Not Found`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X PATCH http://localhost:8000/api/v1/tasks/e5f6a7b8-1234-4000-8000-000000000001 \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

---

### 6.4 DELETE /tasks/{task_id}

Menghapus tugas berdasarkan ID.

| Item | Nilai |
|------|-------|
| **Method** | `DELETE` |
| **Path** | `/api/v1/tasks/{task_id}` |
| **Auth** | Tidak diperlukan |
| **Request Body** | — |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `task_id` | `UUID` | ID tugas |

**Response Body:** Tidak ada (204 No Content).

**Status Codes:** `204 No Content`, `404 Not Found`

**Contoh cURL:**

```bash
curl -X DELETE http://localhost:8000/api/v1/tasks/e5f6a7b8-1234-4000-8000-000000000001
```

---

## 7. Accounts & Contacts (Akun & Kontak)

Account merepresentasikan perusahaan customer, sedangkan Contact merepresentasikan orang di dalam perusahaan tersebut.

### 7.1 GET /accounts

Mengambil daftar seluruh akun (perusahaan), diurutkan berdasarkan `name` (ascending).

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/accounts` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):** Array of `AccountResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik akun |
| `name` | `string` | Nama perusahaan |
| `industry` | `string \| null` | Industri (mis. `Technology`, `Healthcare`) |
| `website` | `string \| null` | URL website |
| `size` | `string \| null` | Ukuran perusahaan (mis. `51-200`) |
| `region` | `string \| null` | Wilayah/region (mis. `Jakarta`) |
| `created_at` | `datetime` | Timestamp pembuatan |

**Contoh Response:**

```json
[
  {
    "id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "PT Maju Jaya Teknologi",
    "industry": "Technology",
    "website": "https://majujaya.id",
    "size": "51-200",
    "region": "Jakarta",
    "created_at": "2026-09-28T07:00:00"
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/accounts
```

---

### 7.2 POST /accounts

Membuat akun (perusahaan) baru.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/accounts` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `AccountCreate` (JSON) |

**Request Body (`AccountCreate`):**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `name` | `string` | **Ya** | — | Nama perusahaan |
| `industry` | `string` | Tidak | `null` | Industri |
| `website` | `string` | Tidak | `null` | URL website |
| `size` | `string` | Tidak | `null` | Ukuran perusahaan |
| `region` | `string` | Tidak | `null` | Wilayah/region |

**Contoh Request Body:**

```json
{
  "name": "PT Sukses Mandiri Digital",
  "industry": "Technology",
  "website": "https://suksesmandiri.id",
  "size": "201-500",
  "region": "Jakarta"
}
```

**Response Body (201):** `AccountResponse`

**Status Codes:** `201 Created`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PT Sukses Mandiri Digital",
    "industry": "Technology",
    "region": "Jakarta"
  }'
```

---

### 7.3 GET /accounts/{account_id}/contacts

Mengambil daftar kontak untuk sebuah akun, diurutkan berdasarkan `name` (ascending).

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/accounts/{account_id}/contacts` |
| **Auth** | Tidak diperlukan |
| **Request Body** | — |

**Path Parameters:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `account_id` | `UUID` | ID akun |

**Response Body (200):** Array of `ContactResponse`

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik kontak |
| `account_id` | `UUID \| null` | ID akun terkait |
| `name` | `string` | Nama kontak |
| `email` | `string \| null` | Alamat email |
| `phone` | `string \| null` | Nomor telepon |
| `role` | `string \| null` | Jabatan/peran |
| `created_at` | `datetime` | Timestamp pembuatan |

**Contoh Response:**

```json
[
  {
    "id": "f6a7b8c9-1234-4000-8000-000000000001",
    "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "Rudi Hartono",
    "email": "rudi@majujaya.id",
    "phone": "081234567890",
    "role": "CTO",
    "created_at": "2026-09-28T07:05:00"
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/accounts/a1b2c3d4-0001-4000-8000-000000000001/contacts
```

---

### 7.4 POST /accounts/contacts

Membuat kontak baru. Kontak dapat dikaitkan dengan akun tertentu atau berdiri sendiri (`account_id` opsional).

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/accounts/contacts` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `ContactCreate` (JSON) |

**Request Body (`ContactCreate`):**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `account_id` | `UUID` | Tidak | `null` | ID akun terkait |
| `name` | `string` | **Ya** | — | Nama kontak |
| `email` | `string` | Tidak | `null` | Alamat email |
| `phone` | `string` | Tidak | `null` | Nomor telepon |
| `role` | `string` | Tidak | `null` | Jabatan/peran |

**Contoh Request Body:**

```json
{
  "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
  "name": "Maya Sari",
  "email": "maya@majujaya.id",
  "phone": "081234567891",
  "role": "Procurement Manager"
}
```

**Response Body (201):** `ContactResponse`

**Status Codes:** `201 Created`, `422 Unprocessable Entity`

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/accounts/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "Maya Sari",
    "email": "maya@majujaya.id",
    "role": "Procurement Manager"
  }'
```

---

## 8. Users (Pengguna / Sales Rep)

User merepresentasikan sales representative atau manager yang memiliki kuota penjualan dan menjadi pemilik (owner) opportunity.

> **Catatan:** Pada implementasi saat ini, model `User` dan skema `UserCreate`/`UserResponse` telah didefinisikan pada kode sumber (`backend/app/schemas/common.py` dan `backend/app/models/__init__.py`), serta tabel `users` tersedia di database. Namun, **belum ada endpoint REST publik** yang mengekspos operasi CRUD pada resource User (mis. `GET /api/v1/accounts/users` atau `POST /api/v1/users`). Data user saat ini diisi melalui proses *seeding* (`backend/app/db/seed.py`) dan digunakan oleh endpoint [Dashboard Rep-Performance](#93-get-dashboardrep-performance) serta sebagai referensi `owner_id` pada opportunity, `created_by` pada activity, dan `assigned_to` pada task.

**Skema yang tersedia (untuk referensi internal / integrasi mendatang):**

**`UserCreate`:**

| Field | Tipe | Wajib | Default | Deskripsi |
|-------|------|-------|---------|-----------|
| `name` | `string` | **Ya** | — | Nama lengkap user |
| `email` | `string` | **Ya** | — | Alamat email (unik) |
| `role` | `string` | Tidak | `sales_rep` | Peran (`sales_rep` atau `sales_manager`) |
| `quota` | `float` | Tidak | `0` | Target kuota penjualan |

**`UserResponse`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | `UUID` | ID unik user |
| `name` | `string` | Nama lengkap |
| `email` | `string` | Alamat email |
| `role` | `string` | Peran |
| `quota` | `float` | Target kuota penjualan |
| `created_at` | `datetime` | Timestamp pembuatan |

**Contoh data User (hasil seeding):**

```json
{
  "id": "c3d4e5f6-0001-4000-8000-000000000001",
  "name": "Andi Wijaya",
  "email": "andi.wijaya@renrnd.com",
  "role": "sales_rep",
  "quota": 500000000,
  "created_at": "2026-09-28T06:00:00"
}
```

---

## 9. Dashboard

Endpoint dashboard menyediakan metrik agregat untuk visualisasi frontend dan integrasi BI (mis. Tableau). Beberapa endpoint me-refresh *materialized view* PostgreSQL sebelum mengembalikan data.

### 9.1 GET /dashboard/summary

Ringkasan pipeline per stage: jumlah deal, total nilai, dan rata-rata probabilitas menang.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/dashboard/summary` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):** Array of objek ringkasan per stage

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `stage_name` | `string` | Nama stage |
| `stage_order` | `int` | Urutan stage |
| `deal_count` | `int` | Jumlah deal pada stage ini |
| `total_value` | `float` | Total nilai semua deal pada stage ini |
| `avg_probability` | `float` | Rata-rata probabilitas menang |

**Contoh Response:**

```json
[
  {
    "stage_name": "Prospecting",
    "stage_order": 1,
    "deal_count": 3,
    "total_value": 525000000.0,
    "avg_probability": 0.10
  },
  {
    "stage_name": "Qualification",
    "stage_order": 2,
    "deal_count": 5,
    "total_value": 1690000000.0,
    "avg_probability": 0.25
  },
  {
    "stage_name": "Proposal",
    "stage_order": 3,
    "deal_count": 4,
    "total_value": 1400000000.0,
    "avg_probability": 0.50
  },
  {
    "stage_name": "Negotiation",
    "stage_order": 4,
    "deal_count": 3,
    "total_value": 1840000000.0,
    "avg_probability": 0.70
  },
  {
    "stage_name": "Closed Won",
    "stage_order": 5,
    "deal_count": 2,
    "total_value": 170000000.0,
    "avg_probability": 1.00
  },
  {
    "stage_name": "Closed Lost",
    "stage_order": 6,
    "deal_count": 1,
    "total_value": 45000000.0,
    "avg_probability": 0.00
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/dashboard/summary
```

---

### 9.2 GET /dashboard/forecast

Forecast pipeline berbobot per bulan berdasarkan tanggal tutup (`close_date`). Hanya mencakup deal yang **belum closed**. Endpoint ini me-refresh materialized view `mv_forecast_data` sebelum membaca data.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/dashboard/forecast` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):** Array of objek forecast per bulan

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `month` | `string` | Bulan (dari `close_date` yang di-truncate per bulan) |
| `weighted_pipeline` | `float` | Pipeline berbobot = `SUM(value * win_probability)` |
| `unweighted_pipeline` | `float` | Pipeline tidak berbobot = `SUM(value)` |
| `deal_count` | `int` | Jumlah deal pada bulan ini |
| `avg_probability` | `float` | Rata-rata probabilitas menang |

**Contoh Response:**

```json
[
  {
    "month": "2026-10-01",
    "weighted_pipeline": 122500000.0,
    "unweighted_pipeline": 925000000.0,
    "deal_count": 5,
    "avg_probability": 0.18
  },
  {
    "month": "2026-11-01",
    "weighted_pipeline": 672000000.0,
    "unweighted_pipeline": 1340000000.0,
    "deal_count": 5,
    "avg_probability": 0.46
  },
  {
    "month": "2026-12-01",
    "weighted_pipeline": 1008000000.0,
    "unweighted_pipeline": 1440000000.0,
    "deal_count": 4,
    "avg_probability": 0.60
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/dashboard/forecast
```

---

### 9.3 GET /dashboard/rep-performance

Metrik performa sales rep (hanya user dengan role `sales_rep`). Endpoint ini me-refresh materialized view `mv_rep_performance` sebelum membaca data.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/dashboard/rep-performance` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):** Array of objek performa per sales rep

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `rep_id` | `string` (UUID) | ID sales rep |
| `rep_name` | `string` | Nama sales rep |
| `total_deals` | `int` | Total deal yang dimiliki |
| `won_deals` | `int` | Jumlah deal yang dimenangkan (Closed Won) |
| `won_revenue` | `float` | Total revenue dari deal yang dimenangkan |
| `avg_deal_size` | `float` | Rata-rata ukuran deal |
| `quota` | `float` | Target kuota penjualan |

**Contoh Response:**

```json
[
  {
    "rep_id": "c3d4e5f6-0001-4000-8000-000000000001",
    "rep_name": "Andi Wijaya",
    "total_deals": 7,
    "won_deals": 1,
    "won_revenue": 95000000.0,
    "avg_deal_size": 284285714.0,
    "quota": 500000000.0
  },
  {
    "rep_id": "c3d4e5f6-0001-4000-8000-000000000002",
    "rep_name": "Siti Rahayu",
    "total_deals": 5,
    "won_deals": 0,
    "won_revenue": 0.0,
    "avg_deal_size": 244000000.0,
    "quota": 500000000.0
  },
  {
    "rep_id": "c3d4e5f6-0001-4000-8000-000000000003",
    "rep_name": "Budi Santoso",
    "total_deals": 6,
    "won_deals": 1,
    "won_revenue": 75000000.0,
    "avg_deal_size": 212500000.0,
    "quota": 400000000.0
  }
]
```

**Status Codes:** `200 OK`

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/dashboard/rep-performance
```

---

## 10. AI Agents (Agen AI)

Endpoint untuk memicu tiga agen AI: **Opportunity Agent**, **Pipeline Agent**, dan **Insight Agent**. Ketiganya didukung oleh LLM BytePlus ModelArk (Skylark-lite untuk NER cepat, Skylark-pro untuk reasoning). Setiap eksekusi agen dicatat ke tabel `agent_logs` sebagai audit trail.

### 10.1 POST /agents/opportunity/run

Memicu **Opportunity Agent** untuk memproses input mentah (email, catatan meeting, transkrip, dll). Alur kerja agen:

1. **Ekstraksi entitas** (Skylark-lite) — nama perusahaan, kontak, kebutuhan, anggaran, timeline, sentimen.
2. **Skoring BANT** (Skylark-pro) — Budget, Authority, Need, Timeline; masing-masing 0.0–1.0 dengan total.
3. **Pembuatan opportunity otomatis** — jika total skor BANT > 0.5, agen membuat opportunity baru (mencari/membuat akun, menetapkan stage awal Prospecting, dan menyematkan embedding vektor untuk pencarian semantik).
4. **Logging** — seluruh input dan output dicatat ke `agent_logs`.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/agents/opportunity/run` |
| **Auth** | Tidak diperlukan |
| **Request Body** | `AgentTrigger` (JSON) |

**Request Body (`AgentTrigger`):**

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `raw_input` | `string` | **Ya** | Teks mentah untuk dianalisis (email, meeting note, transkrip, dll) |

**Contoh Request Body:**

```json
{
  "raw_input": "Diterima email dari Rudi Hartono, CTO PT Maju Jaya Teknologi. Mereka butuh sistem CRM enterprise dengan budget sekitar 500 juta, ingin live dalam 3 bulan. Tertarik dengan fitur AI analytics."
}
```

**Response Body (200):**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `entities` | `object` | Entitas yang diekstrak dari input |
| `bant_score` | `object` | Skor BANT per dimensi dan total |
| `opportunity_created` | `bool` | `true` jika opportunity dibuat otomatis |
| `opportunity` | `object \| null` | Detail opportunity yang dibuat (jika ada) |

**Struktur `entities`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `company_name` | `string` | Nama perusahaan |
| `contact_name` | `string` | Nama kontak |
| `contact_email` | `string` | Email kontak |
| `need` | `string` | Kebutuhan |
| `budget_mentioned` | `string` | Anggaran yang disebutkan |
| `timeline` | `string` | Timeline |
| `sentiment` | `string` | Sentimen (`positive`/`neutral`/`negative`) |

**Struktur `bant_score`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `budget` | `float` | Skor Budget (0.0–1.0) |
| `authority` | `float` | Skor Authority (0.0–1.0) |
| `need` | `float` | Skor Need (0.0–1.0) |
| `timeline` | `float` | Skor Timeline (0.0–1.0) |
| `total` | `float` | Total skor BANT (0.0–1.0) |
| `reasoning` | `string` | Penjelasan skor |

**Contoh Response:**

```json
{
  "entities": {
    "company_name": "PT Maju Jaya Teknologi",
    "contact_name": "Rudi Hartono",
    "contact_email": null,
    "need": "Sistem CRM enterprise dengan fitur AI analytics",
    "budget_mentioned": "500 juta",
    "timeline": "3 bulan",
    "sentiment": "positive"
  },
  "bant_score": {
    "budget": 0.8,
    "authority": 0.7,
    "need": 0.9,
    "timeline": 0.6,
    "total": 0.75,
    "reasoning": "Prospect memiliki kebutuhan jelas, anggaran memadai, dan timeline tertentu. Kontak adalah CTO (decision maker)."
  },
  "opportunity_created": true,
  "opportunity": {
    "id": "b2c3d4e5-1234-4000-8000-000000000500",
    "name": "PT Maju Jaya Teknologi - Sistem CRM enterprise dengan fitur AI analytics",
    "value": 50000000
  }
}
```

> **Catatan:** Nilai deal default yang dibuat agen adalah IDR 50.000.000 (`50000000`). Threshold pembuatan opportunity otomatis adalah total skor BANT > 0.5.

**Status Codes:** `200 OK`, `422 Unprocessable Entity`, `5xx` (jika LLM tidak tersedia)

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/agents/opportunity/run \
  -H "Content-Type: application/json" \
  -d '{
    "raw_input": "Diterima email dari Rudi Hartono, CTO PT Maju Jaya Teknologi. Mereka butuh sistem CRM enterprise dengan budget sekitar 500 juta, ingin live dalam 3 bulan."
  }'
```

---

### 10.2 POST /agents/pipeline/scan

Memicu **Pipeline Agent** untuk memindai seluruh opportunity yang **belum closed** dan mengevaluasi setiap deal. Agen menganalisis konteks deal (stage, nilai, aktivitas, probabilitas, hari menuju close) menggunakan Skylark-pro, lalu memberikan rekomendasi.

Tidak memerlukan request body.

| Item | Nilai |
|------|-------|
| **Method** | `POST` |
| **Path** | `/api/v1/agents/pipeline/scan` |
| **Auth** | Tidak diperlukan |
| **Request Body** | — |

**Response Body (200):** Array of objek evaluasi per opportunity

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `opp_id` | `string` (UUID) | ID opportunity |
| `opp_name` | `string` | Nama opportunity |
| `evaluation` | `object` | Hasil evaluasi agen |

**Struktur `evaluation`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `should_advance` | `bool` | Apakah deal layak dimajukan ke stage berikutnya |
| `target_stage` | `string \| null` | Nama stage tujuan (jika `should_advance` = true) |
| `reasoning` | `string` | Penalaran agen |
| `updated_win_probability` | `float` | Probabilitas menang yang diperbarui (jika diubah, disimpan ke DB) |
| `next_best_action` | `object` | Rekomendasi tindakan terbaik |
| `risk_flags` | `array` | Daftar indikator risiko |

**Struktur `next_best_action`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `action` | `string` | Tipe tindakan (`call`, `email`, `demo`, `follow_up`, `proposal`, `send_quote`) |
| `description` | `string` | Detail tindakan |
| `priority` | `string` | Prioritas (`high`, `medium`, `low`) |

**Contoh Response:**

```json
[
  {
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000001",
    "opp_name": "PT Maju Jaya Teknologi - Sistem CRM Enterprise",
    "evaluation": {
      "should_advance": false,
      "target_stage": null,
      "reasoning": "Deal masih di stage Prospecting dengan hanya 1 aktivitas dan probabilitas rendah (0.10). Belum cukup indikator untuk memajukan stage.",
      "updated_win_probability": 0.15,
      "next_best_action": {
        "action": "call",
        "description": "Lakukan discovery call untuk memvalidasi kebutuhan dan budget prospect.",
        "priority": "high"
      },
      "risk_flags": [
        "Aktivitas sangat sedikit",
        "Probabilitas menang rendah"
      ]
    }
  },
  {
    "opp_id": "b2c3d4e5-1234-4000-8000-000000000005",
    "opp_name": "PT Bumi Sehat Indonesia - Hospital Information System",
    "evaluation": {
      "should_advance": true,
      "target_stage": "Closed Won",
      "reasoning": "Deal di stage Negotiation dengan probabilitas tinggi (0.70) dan close date dalam 14 hari. Aktivitas konsisten. Layak dimajukan.",
      "updated_win_probability": 0.85,
      "next_best_action": {
        "action": "send_quote",
        "description": "Kirim quotation final dan draft kontrak untuk ditandatangani sebelum close date.",
        "priority": "high"
      },
      "risk_flags": []
    }
  }
]
```

> **Catatan:** Jika `updated_win_probability` bernilai valid (0.0–1.0), Pipeline Agent akan langsung menyimpan nilai probabilitas yang diperbarui ke database opportunity.

**Status Codes:** `200 OK`, `5xx` (jika LLM tidak tersedia)

**Contoh cURL:**

```bash
curl -X POST http://localhost:8000/api/v1/agents/pipeline/scan
```

---

### 10.3 GET /agents/insight/briefing

Memicu **Insight Agent** untuk menghasilkan daily briefing — ringkasan naratif pipeline, insight, alert, dan rekomendasi utama. Agen mengagregasi metrik pipeline (total weighted pipeline, total open deals, rata-rata probabilitas) lalu menghasilkan narasi menggunakan Skylark-pro.

| Item | Nilai |
|------|-------|
| **Method** | `GET` |
| **Path** | `/api/v1/agents/insight/briefing` |
| **Auth** | Tidak diperlukan |
| **Query Params** | — |
| **Request Body** | — |

**Response Body (200):**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `metrics` | `object` | Metrik agregat pipeline |
| `briefing` | `object` | Narasi briefing dari AI |

**Struktur `metrics`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `total_weighted_pipeline` | `float` | Total pipeline berbobot (`SUM(value * win_probability)`) |
| `total_open_deals` | `int` | Jumlah deal yang belum closed |
| `avg_win_probability` | `float` | Rata-rata probabilitas menang |
| `date` | `string` (datetime) | Timestamp generasi briefing |

**Struktur `briefing`:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `summary` | `string` | Ringkasan 2–3 kalimat |
| `insights` | `array` | Daftar insight menarik |
| `alerts` | `array` | Daftar alert/action items |
| `recommendation` | `string` | Rekomendasi utama |

**Contoh Response:**

```json
{
  "metrics": {
    "total_weighted_pipeline": 2058000000.0,
    "total_open_deals": 17,
    "avg_win_probability": 0.36,
    "date": "2026-09-28T07:45:00"
  },
  "briefing": {
    "summary": "Pipeline Anda memiliki 17 deal aktif dengan weighted pipeline Rp 2,058 miliar. Rata-rata probabilitas menang adalah 36%, dengan 3 deal di stage Negotiation yang mendekati close.",
    "insights": [
      "3 deal di stage Negotiation bernilai total Rp 1,84 miliar dan memiliki probabilitas tinggi (70%+)",
      "Rata-rata ukuran deal terbesar berada di segmen Healthcare"
    ],
    "alerts": [
      "Deal PT Bumi Sehat Indonesia - Hospital Information System close dalam 14 hari, prioritas tinggi",
      "Beberapa deal di Prospecting tidak memiliki aktivitas dalam 7 hari terakhir"
    ],
    "recommendation": "Fokus pada penutupan 3 deal di stage Negotiation minggu ini untuk mencapai Rp 1,84 miliar revenue."
  }
}
```

**Status Codes:** `200 OK`, `5xx` (jika LLM tidak tersedia)

**Contoh cURL:**

```bash
curl -X GET http://localhost:8000/api/v1/agents/insight/briefing
```

---

## 11. Referensi Skema Data

Bagian ini merangkum seluruh skema (Pydantic models) yang digunakan API.

### OpportunityCreate

```json
{
  "account_id": "UUID | null",
  "name": "string (wajib)",
  "stage_id": "UUID | null",
  "value": "float (wajib)",
  "currency": "string = IDR",
  "close_date": "date | null",
  "owner_id": "UUID | null",
  "source": "string | null"
}
```

### OpportunityUpdate (semua field opsional)

```json
{
  "name": "string",
  "stage_id": "UUID",
  "value": "float",
  "close_date": "date",
  "win_probability": "float",
  "owner_id": "UUID"
}
```

### OpportunityResponse

```json
{
  "id": "UUID",
  "account_id": "UUID | null",
  "name": "string",
  "stage_id": "UUID | null",
  "value": "float",
  "currency": "string",
  "close_date": "date | null",
  "win_probability": "float",
  "owner_id": "UUID | null",
  "source": "string | null",
  "ai_metadata": "object | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### StageResponse

```json
{
  "id": "UUID",
  "name": "string",
  "order": "int",
  "probability": "float",
  "is_closed": "bool",
  "is_won": "bool"
}
```

### ActivityCreate

```json
{
  "opp_id": "UUID (wajib)",
  "type": "string (wajib)",
  "description": "string | null",
  "created_by": "UUID | null"
}
```

### ActivityResponse

```json
{
  "id": "UUID",
  "opp_id": "UUID",
  "type": "string",
  "description": "string | null",
  "created_by": "UUID | null",
  "created_at": "datetime"
}
```

### TaskCreate

```json
{
  "opp_id": "UUID (wajib)",
  "title": "string (wajib)",
  "due_date": "date | null",
  "assigned_to": "UUID | null"
}
```

### TaskUpdate (semua field opsional)

```json
{
  "title": "string",
  "due_date": "date",
  "status": "string"
}
```

### TaskResponse

```json
{
  "id": "UUID",
  "opp_id": "UUID",
  "title": "string",
  "due_date": "date | null",
  "status": "string",
  "assigned_to": "UUID | null",
  "created_at": "datetime"
}
```

### AccountCreate

```json
{
  "name": "string (wajib)",
  "industry": "string | null",
  "website": "string | null",
  "size": "string | null",
  "region": "string | null"
}
```

### AccountResponse

```json
{
  "id": "UUID",
  "name": "string",
  "industry": "string | null",
  "website": "string | null",
  "size": "string | null",
  "region": "string | null",
  "created_at": "datetime"
}
```

### ContactCreate

```json
{
  "account_id": "UUID | null",
  "name": "string (wajib)",
  "email": "string | null",
  "phone": "string | null",
  "role": "string | null"
}
```

### ContactResponse

```json
{
  "id": "UUID",
  "account_id": "UUID | null",
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "role": "string | null",
  "created_at": "datetime"
}
```

### UserCreate / UserResponse (skema internal)

```json
// UserCreate
{
  "name": "string (wajib)",
  "email": "string (wajib, unik)",
  "role": "string = sales_rep",
  "quota": "float = 0"
}

// UserResponse
{
  "id": "UUID",
  "name": "string",
  "email": "string",
  "role": "string",
  "quota": "float",
  "created_at": "datetime"
}
```

---

## 12. Tabel Stages Default

Berikut adalah stage pipeline default yang di-seed saat inisialisasi database (`backend/app/db/init.sql`):

| Order | Nama Stage | Probability | is_closed | is_won | Deskripsi |
|-------|-----------|-------------|-----------|--------|-----------|
| 1 | Prospecting | 0.10 | `false` | `false` | Identifikasi awal prospek |
| 2 | Qualification | 0.25 | `false` | `false` | Kualifikasi kebutuhan & budget |
| 3 | Proposal | 0.50 | `false` | `false` | Proposal/solusi dikirim |
| 4 | Negotiation | 0.70 | `false` | `false` | Negosiasi harga & terms |
| 5 | Closed Won | 1.00 | `true` | `true` | Deal dimenangkan |
| 6 | Closed Lost | 0.00 | `true` | `false` | Deal gagal |

---

## 13. Lampiran

### 13.1 Ringkasan Endpoint

| # | Method | Endpoint | Deskripsi | Status Codes |
|---|--------|----------|-----------|--------------|
| 1 | `GET` | `/health` | Cek status aplikasi | 200 |
| 2 | `GET` | `/` | Metadata aplikasi | 200 |
| 3 | `GET` | `/api/v1/stages` | Daftar stage pipeline | 200 |
| 4 | `GET` | `/api/v1/opportunities` | Daftar opportunity | 200 |
| 5 | `POST` | `/api/v1/opportunities` | Buat opportunity | 201, 422 |
| 6 | `GET` | `/api/v1/opportunities/{opp_id}` | Detail opportunity | 200, 404 |
| 7 | `PATCH` | `/api/v1/opportunities/{opp_id}` | Update opportunity | 200, 404, 422 |
| 8 | `DELETE` | `/api/v1/opportunities/{opp_id}` | Hapus opportunity | 204, 404 |
| 9 | `GET` | `/api/v1/activities` | Daftar aktivitas | 200 |
| 10 | `POST` | `/api/v1/activities` | Buat aktivitas | 201, 422 |
| 11 | `DELETE` | `/api/v1/activities/{activity_id}` | Hapus aktivitas | 204, 404 |
| 12 | `GET` | `/api/v1/tasks` | Daftar tugas | 200 |
| 13 | `POST` | `/api/v1/tasks` | Buat tugas | 201, 422 |
| 14 | `PATCH` | `/api/v1/tasks/{task_id}` | Update tugas | 200, 404, 422 |
| 15 | `DELETE` | `/api/v1/tasks/{task_id}` | Hapus tugas | 204, 404 |
| 16 | `GET` | `/api/v1/accounts` | Daftar akun | 200 |
| 17 | `POST` | `/api/v1/accounts` | Buat akun | 201, 422 |
| 18 | `GET` | `/api/v1/accounts/{account_id}/contacts` | Daftar kontak akun | 200 |
| 19 | `POST` | `/api/v1/accounts/contacts` | Buat kontak | 201, 422 |
| 20 | `GET` | `/api/v1/dashboard/summary` | Ringkasan pipeline per stage | 200 |
| 21 | `GET` | `/api/v1/dashboard/forecast` | Forecast berbobot per bulan | 200 |
| 22 | `GET` | `/api/v1/dashboard/rep-performance` | Performa sales rep | 200 |
| 23 | `POST` | `/api/v1/agents/opportunity/run` | Jalankan Opportunity Agent | 200, 422 |
| 24 | `POST` | `/api/v1/agents/pipeline/scan` | Scan & evaluasi pipeline | 200 |
| 25 | `GET` | `/api/v1/agents/insight/briefing` | Daily briefing AI | 200 |

### 13.2 Catatan Teknis

- **Database:** PostgreSQL dengan ekstensi `pgvector` (vektor 1024 dimensi untuk pencarian semantik opportunity) dan `uuid-ossp`.
- **LLM Provider:** BytePlus ModelArk — `skylark-lite` (NER/ekstraksi cepat), `skylark-pro` (reasoning/scoring), `skylark-embedding-vision` (embedding).
- **Materialized Views:** `mv_funnel_summary`, `mv_forecast_data`, `mv_rep_performance` — di-refresh secara konkuren pada endpoint dashboard tertentu.
- **Cascade Delete:** Penghapusan `Opportunity` akan menghapus `Activity` dan `Task` terkait. Penghapusan `Account` akan menghapus `Contact` terkait.
- **Audit Trail:** Setiap eksekusi AI Agent mencatat input, output, token usage, dan status ke tabel `agent_logs`.
- **Konfigurasi:** Seluruh konfigurasi (DATABASE_URL, REDIS_URL, ARK_API_KEY, JWT) dikelola via environment variables / file `.env`.

### 13.3 Catatan Keamanan

- Endpoint `GET /health` dan `GET /` tidak memerlukan autentikasi.
- Pada implementasi saat ini, endpoint CRUD tidak dilindungi autentikasi JWT (mode development). Konfigurasi JWT (`JWT_SECRET`, `JWT_ALGORITHM=HS256`, `JWT_EXPIRE_MINUTES=1440`) telah disiapkan untuk produksi.
- CORS diaktifkan hanya untuk origin `http://localhost:3000`.
- `JWT_SECRET` **wajib** diganti pada lingkungan produksi.

---

*Dokumen ini dibuat berdasarkan analisis kode sumber pada `backend/app/`. Untuk dokumentasi interaktif terbaru, akses Swagger UI di `http://localhost:8000/docs`.*
