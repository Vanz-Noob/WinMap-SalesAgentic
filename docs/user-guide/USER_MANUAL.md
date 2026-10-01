# User Manual — RenRND Sales Agentic AI

Panduan pengguna untuk aplikasi RenRND Sales Agentic AI. Dokumen ini ditujukan untuk end-user: **sales manager** dan **sales rep**.

---

## 1. Pendahuluan

**RenRND Sales Agentic AI** adalah aplikasi AI agentic untuk otomatisasi siklus penjualan — dari deteksi peluang hingga dashboard real-time.

Aplikasi ini dilengkapi dengan 3 AI Agent yang membantu:
- **Opportunity Agent** — mengekstrak peluang dari teks mentah (email, catatan meeting)
- **Pipeline Agent** — mengevaluasi deal aktif dan memperbarui win probability
- **Insight Agent** — menghasilkan daily briefing dengan insight dan rekomendasi

---

## 2. Akses Aplikasi

| Lingkungan | URL |
|-----------|-----|
| Development | `http://localhost:3000` |
| Production (via Nginx) | `http://localhost` |
| API Documentation (Swagger) | `http://localhost:8000/docs` |

---

## 3. Halaman Dashboard (/)

Dashboard adalah halaman utama yang menampilkan ringkasan pipeline penjualan secara real-time.

### Komponen Dashboard

- **4 Stat Cards:**
  - **Total Pipeline** — total nilai semua deal aktif
  - **Open Deals** — jumlah deal yang masih aktif
  - **Win Rate** — persentase deal yang berhasil dimenangkan
  - **Avg Deal Size** — rata-rata nilai per deal

- **Bar Chart:** Sales Funnel per stage — memvisualisasikan jumlah deal di setiap stage pipeline

- **Pie Chart:** Distribusi opportunity per stage — menampilkan proporsi deal di tiap stage

- **Tabel:** Opportunities terbaru — daftar opportunity yang baru ditambahkan atau diperbarui

---

## 4. Pipeline Kanban (/pipeline)

Halaman Kanban menampilkan pipeline penjualan dalam bentuk papan kolom (stage) dengan kartu opportunity yang bisa di-drag & drop.

### Fitur

- **Drag & drop** opportunity antar stage
- **Optimistic update** — UI langsung responsif tanpa menunggu response server
- Setiap card menampilkan:
  - **Name** — nama opportunity
  - **Value** — nilai deal
  - **Win probability bar** — bar visual probabilitas menang
  - **Source badge** — indikator sumber (manual vs AI)

### Cara Pakai Drag & Drop

1. Klik & tahan (click & hold) pada card opportunity yang ingin dipindahkan
2. Drag card ke kolom stage tujuan
3. Lepaskan (release) card di kolom tersebut
4. Stage opportunity otomatis terupdate

---

## 5. Opportunities (/opportunities)

Halaman daftar semua opportunities dalam bentuk tabel.

### Fitur

- **Tabel list** semua opportunities
- **Filter by stage** — saring opportunity berdasarkan stage
- **Win probability bar** — visualisasi probabilitas menang
- **Source badge** — indikator sumber (manual vs AI)
- **Klik row** untuk membuka halaman detail opportunity

---

## 6. Opportunity Detail (/opportunities/[id])

Halaman detail untuk satu opportunity spesifik.

### Fitur

- **Inline editing** — klik field untuk mengedit langsung (name, value, stage, close_date, owner, dll.)
- **Aktivitas timeline** — riwayat aktivitas (calls, meetings, emails) dalam urutan kronologis
- **AI metadata** — informasi tambahan jika opportunity dibuat oleh AI:
  - BANT score (budget, authority, need, timeline)
  - Entities (company_name, contact_name, need, budget, timeline)
- **Tasks list** — daftar tugas terkait opportunity dengan status (pending, in-progress, done)

---

## 7. Create Opportunity (/opportunities/new)

Halaman untuk membuat opportunity baru.

### Cara Membuat

1. **Form manual** — isi field berikut:
   - **Name** — nama opportunity
   - **Value** — nilai deal
   - **Stage** — stage awal
   - **Close date** — tanggal target tutup
   - **Owner** — penanggung jawab deal
2. Klik **Save** untuk menyimpan

Atau:

**Gunakan AI Agent** — lihat [Bagian 8. AI Agents](#8-ai-agents-agents) untuk membuat opportunity secara otomatis dari teks mentah.

---

## 8. AI Agents (/agents)

Halaman AI Agents menyediakan 3 agent yang bisa di-trigger manual.

### Opportunity Agent

Mengekstrak peluang dari teks mentah dan membuat opportunity otomatis.

- **Input:** text mentah (email, meeting note, dll.)
- **Contoh input:**
  > "PT Maju Jaya butuh CRM, budget 500jt, Budi CTO, keputusan 2 bulan"
- **Output:**
  - Entities extracted (company_name, contact_name, need, budget, timeline)
  - BANT score (budget, authority, need, timeline — masing-masing 0–1)
  - **Auto-create** opportunity jika total BANT score > 0.5

### Pipeline Agent

Mengevaluasi semua deal aktif dalam pipeline.

- **Scan semua deal aktif** (`is_closed = false`)
- **Update win probability** untuk setiap deal
- **Berikan next best action** — tindakan terbaik berikutnya dengan prioritas
- **Risk flags** — daftar concern (stalled, no activity, dll.)

### Insight Agent

Menghasilkan briefing harian untuk sales manager.

- **Generate daily briefing** berdasarkan metrik pipeline terkini
- **Summary** — ikhtisar singkat kondisi pipeline
- **Insights** — daftar observasi menarik
- **Alerts** — daftar action items / concern yang perlu diperhatikan
- **Recommendation** — rekomendasi strategis utama

---

## 9. Analytics (/analytics)

Halaman analytics untuk analisis mendalam performa penjualan.

### Fitur

- **Bar chart:** Revenue per stage — pendapatan yang diproyeksikan per stage pipeline
- **Line chart:** Forecast per bulan — perbandingan weighted vs unweighted forecast
  - **Weighted forecast** — nilai deal × win probability
  - **Unweighted forecast** — nilai deal tanpa pembobotan
- **Tableau embed** — tempel (paste) URL dari Tableau Server untuk menampilkan dashboard eksternal

---

## 10. Tips & Best Practices

1. **Input data selengkap mungkin** di setiap opportunity — isi value, close_date, dan owner agar AI Agent dapat mengevaluasi dengan akurat.

2. **Gunakan Opportunity Agent** untuk memproses email dan meeting notes secara otomatis. Cukup tempel teks mentah, agent akan mengekstrak entitas dan menghitung BANT score.

3. **Cek Daily Briefing setiap pagi** untuk mendapat insight dan alert terbaru dari Insight Agent mengenai kondisi pipeline.

4. **Pipeline Agent berjalan otomatis tiap jam**, tetapi bisa di-trigger manual kapan saja dari halaman AI Agents jika ingin evaluasi real-time.

5. **Gunakan drag & drop di Kanban** untuk update stage opportunity dengan cepat dan efisien tanpa membuka halaman detail.

6. **Perhatikan source badge** — opportunity dengan badge "AI" dibuat otomatis oleh Opportunity Agent. Tinjau dan validasi entitas serta BANT score-nya.

7. **Manfaatkan inline editing** di halaman detail opportunity untuk update informasi dengan cepat tanpa perlu membuka form terpisah.

8. **Pantau risk flags** dari Pipeline Agent — jika ada deal dengan flag "stalled" atau "no activity", segera ambil tindakan follow-up.
