# AI Agent Architecture — RenRND Sales Agentic AI

Dokumen ini menjelaskan arsitektur AI Agent untuk aplikasi RenRND Sales Agentic AI, mencakup strategi model LLM, workflow tiap agent, background tasks, dan audit trail.

---

## 1. Overview

Sistem ini didukung oleh **3 AI Agent** yang ditenagai LLM **BytePlus ModelArk (Skylark)**:

| Agent | Fungsi Utama |
|-------|-------------|
| **Opportunity Agent** | NER (Named Entity Recognition) + BANT scoring + auto-create opportunity |
| **Pipeline Agent** | Evaluasi deal + win probability + rekomendasi next best action |
| **Insight Agent** | Daily briefing + forecast + deteksi anomali |

---

## 2. LLM Model Tiering Strategy

Setiap tugas AI menggunakan model yang sesuai untuk mengoptimalkan biaya dan performa:

| Task | Model | Cost | Reason |
|------|-------|------|--------|
| NER / Entity Extraction | skylark-lite | $0.10–$0.40/M tokens | Fast & cheap for classification |
| BANT Scoring | skylark-pro | $0.40–$1.60/M tokens | Complex reasoning needed |
| Pipeline Evaluation | skylark-pro | $0.40–$1.60/M tokens | Multi-factor analysis |
| Daily Briefing | skylark-pro | $0.40–$1.60/M tokens | Narrative generation |
| Embedding | skylark-embedding-vision | $0.125/M tokens | Semantic search |

---

## 3. Opportunity Agent Workflow

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
  → If total > 0.5: auto-create opportunity in DB
  → If total <= 0.5: log only, no creation
  ↓
Step 4: Logging
  → AgentLog entry (input, output, token_usage, status)
  ↓
Output: {entities, bant_score, opportunity_created, log_id}
```

### Penjelasan Tahapan

1. **Entity Extraction** — Teks mentah (email, catatan meeting, dll.) diproses dengan `skylark-lite` untuk mengekstrak entitas kunci: nama perusahaan, nama kontak, kebutuhan, anggaran, dan timeline.
2. **BANT Scoring** — Entitas yang terekstrak dianalisis dengan `skylark-pro` untuk menghasilkan skor BANT (Budget, Authority, Need, Timeline) masing-masing 0–1, dengan total score 0–1.
3. **Decision** — Jika total skor > 0.5, opportunity otomatis dibuat di database. Jika ≤ 0.5, hanya dicatat di log tanpa pembuatan record.
4. **Logging** — Setiap eksekusi dicatat di tabel `agent_logs` beserta input, output, token usage, dan status.

---

## 4. Pipeline Agent Workflow

```
Input: All active opportunities (is_closed = false)
  ↓
For each opportunity:
  → Gather context: stage, value, activities count, close_date proximity
  → LLM evaluation (skylark-pro):
    - should_advance: boolean (move to next stage?)
    - target_stage: next stage name or null
    - updated_win_probability: 0.0-1.0 (clamped/validated)
    - next_best_action: {action, description, priority}
    - risk_flags: list of concerns (stalled, no activity, etc.)
  → Update win_probability in DB (validated 0.0-1.0)
  → Log evaluation to AgentLog
  ↓
Output: List of evaluations for all deals
```

### Penjelasan Tahapan

1. **Gather Context** — Untuk setiap opportunity aktif (`is_closed = false`), sistem mengumpulkan konteks: stage saat ini, nilai deal, jumlah aktivitas, dan kedekatan dengan close_date.
2. **LLM Evaluation** — `skylark-pro` mengevaluasi setiap deal dan menghasilkan:
   - `should_advance`: apakah deal harus maju ke stage berikutnya
   - `target_stage`: nama stage tujuan atau null
   - `updated_win_probability`: probabilitas menang yang diperbarui (divalidasi 0.0–1.0)
   - `next_best_action`: tindakan terbaik berikutnya dengan action, deskripsi, dan prioritas
   - `risk_flags`: daftar concern (stalled, no activity, dll.)
3. **Update DB** — `win_probability` diperbarui di database setelah validasi range 0.0–1.0.
4. **Logging** — Setiap evaluasi dicatat ke `AgentLog`.

---

## 5. Insight Agent Workflow

```
Input: Pipeline metrics (aggregated from DB)
  → total_weighted_pipeline (Σ value × win_probability for open deals)
  → total_open_deals
  → avg_win_probability
  → deals by stage
  → deals nearing close_date
  ↓
LLM generates briefing (skylark-pro):
  → summary: 2-3 sentence overview
  → insights: list of interesting observations
  → alerts: list of action items / concerns
  → recommendation: main strategic recommendation
  ↓
Output: {metrics: {...}, briefing: {summary, insights[], alerts[], recommendation}}
```

### Penjelasan Tahapan

1. **Aggregate Metrics** — Sistem mengagregasi metrik pipeline dari database:
   - `total_weighted_pipeline`: total nilai pipeline tertimbang (Σ value × win_probability untuk open deals)
   - `total_open_deals`: jumlah deal aktif
   - `avg_win_probability`: rata-rata probabilitas menang
   - `deals by stage`: distribusi deal per stage
   - `deals nearing close_date`: deal yang mendekati tanggal tutup
2. **LLM Briefing** — `skylark-pro` menghasilkan briefing harian:
   - `summary`: ikhtisar 2–3 kalimat
   - `insights`: daftar observasi menarik
   - `alerts`: daftar action items / concern
   - `recommendation`: rekomendasi strategis utama
3. **Output** — Metrik dan briefing dikemas sebagai response terstruktur.

---

## 6. Celery Background Tasks

Task background dijalankan menggunakan **Celery** dengan scheduler periodik:

| Task | Schedule | Description |
|------|----------|-------------|
| `tasks.scan_pipeline` | Every 1 hour | Pipeline Agent evaluates all deals |
| `tasks.daily_briefing` | Every 24 hours | Insight Agent generates daily briefing |

Pipeline Agent berjalan otomatis setiap jam untuk mengevaluasi semua deal aktif. Insight Agent berjalan setiap 24 jam untuk menghasilkan daily briefing.

---

## 7. LLM Client Architecture

- Menggunakan **OpenAI-compatible API** (httpx async client)
- **Base URL:** `https://ark.ap-southeast.bytepluses.com/api/v3`
- **Functions:**
  - `chat_pro()` — untuk tugas yang membutuhkan complex reasoning (menggunakan skylark-pro)
  - `chat_lite()` — untuk tugas klasifikasi cepat (menggunakan skylark-lite)
  - `embed_text()` — untuk semantic search (menggunakan skylark-embedding-vision)
- **Error handling:** `try/except` dengan logging pada semua LLM calls
- **Token usage:** dilacak dan dicatat di `AgentLog` untuk setiap eksekusi agent

---

## 8. RAG (Retrieval-Augmented Generation)

- **Opportunity embeddings** disimpan sebagai `vector(1024)` menggunakan `skylark-embedding-vision`
- **pgvector ivfflat index** untuk cosine similarity search
- Digunakan untuk menemukan opportunity masa lalu yang mirip (similar past opportunities)

RAG memungkinkan sistem untuk mencari dan membandingkan opportunity berdasarkan kemiripan semantik, bukan hanya pencocokan keyword.

---

## 9. Agent Log Audit Trail

Setiap eksekusi agent dicatat di tabel `agent_logs`:

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `agent_type` | string | `"opportunity"` \| `"pipeline"` \| `"insight"` |
| `action` | string | Aksi spesifik yang dilakukan |
| `input` | JSONB | Raw input data |
| `output` | JSONB | Agent response |
| `token_usage` | integer | Total token yang dikonsumsi |
| `status` | string | `"success"` \| `"error"` |
| `timestamp` | datetime | Waktu eksekusi |

Audit trail ini memastikan setiap aksi AI dapat dilacak, dianalisis, dan diaudit untuk transparansi dan debugging.

---

## 10. API Endpoints for Agent Triggers

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/agents/opportunity/run` | `{raw_input: "text"}` | Trigger Opportunity Agent dengan teks mentah |
| `POST` | `/api/v1/agents/pipeline/scan` | (no body) | Trigger Pipeline Agent untuk scan semua deal |
| `GET` | `/api/v1/agents/insight/briefing` | (no body) | Generate fresh briefing dari Insight Agent |

Semua endpoint dapat di-trigger manual melalui API atau dari halaman **AI Agents** di UI aplikasi.
