# WinMap Sales Agentic — Bug Fix Strategy

## Hasil Pengecekan Website (PC & Mobile View)

### Pages Dicek (Semua OK secara fungsional):
| Page | PC View | Mobile View (577px) | Status |
|------|---------|---------------------|--------|
| `/login` | ✅ Form login, show password toggle | ✅ Responsive | Bug: error display |
| `/` (Dashboard) | ✅ 87 nodes, charts, tables | ✅ Grid → 1 kolom | OK |
| `/pipeline` | ✅ Kanban board 6 stage | ✅ Horizontal scroll | OK |
| `/opportunities` | ✅ Tabel, search, delete | ✅ Kolom tersembunyi | OK |
| `/opportunities/new` | ✅ Form lengkap | ✅ Form responsive | Bug: Sales Rep kosong |
| `/opportunities/[id]` | ✅ Detail, aktivitas | ✅ Responsive | OK |
| `/agents` | ✅ 4 agent cards | ✅ Stack vertical | OK |
| `/analytics` | ✅ Charts, tables, forecast | ✅ Charts responsive | OK |
| `/presales-kpi` | ✅ 6 kategori KPI | ✅ Responsive | OK |
| `/admin` | ✅ User table, CRUD | ✅ Kolom tersembunyi | OK |

### Responsive Design — Berfungsi Baik:
- Sidebar: collapse ke hamburger menu di <768px, slide-in animation ✅
- Tabel: kolom non-esensial tersembunyi di viewport sempit ✅
- Grid: multi-kolom → single-kolom di breakpoint Tailwind ✅
- Charts (Recharts): ResponsiveContainer menyesuaikan lebar ✅
- Kanban: horizontal scroll di viewport sempit ✅
- Body: tidak ada horizontal overflow di 577px ✅

---

## Bug Ditemukan

### BUG-01: Secure Cookie over HTTP — Login Gagal (CRITICAL)

**Lokasi:** `backend/app/api/v1/auth.py` lines 62, 85

**Root Cause:**
```python
# auth.py line 62 & 85
response.set_cookie(secure=not settings.DEBUG, **_COOKIE_KWARGS, value=token)
```
Saat `DEBUG=false` (production), cookie diset dengan `secure=True`. Browser menolak cookie `secure` over HTTP, jadi login gagal saat akses via `http://10.157.142.90:8088`.

**Fix Strategy:**
Ganti logika `secure` dari DEBUG flag ke deteksi protocol via `X-Forwarded-Proto` header:

```python
# auth.py — tambahkan import Request
from fastapi import Request

# Ubah login dan register endpoint:
@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    request: Request,  # ← tambahkan
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # ... existing code ...
    
    # Deteksi HTTPS dari X-Forwarded-Proto (CloudFlare/ALB)
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    is_https = forwarded_proto == "https" or request.url.scheme == "https"
    response.set_cookie(secure=is_https, **_COOKIE_KWARGS, value=token)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))
```

**Files to modify:**
1. `backend/app/api/v1/auth.py` — login() dan register() endpoints

---

### BUG-02: Error Display "[object Object]" (HIGH)

**Lokasi:** `frontend/src/lib/api.ts` line 31

**Root Cause:**
```typescript
// api.ts line 31
if (error?.detail) message = error.detail;
```
FastAPI sering return `detail` sebagai array (validation errors) atau object, bukan string. Saat `error.detail` adalah `[{msg: "..."}]`, maka `new Error(message)` mengkonversi ke `"[object Object]"`.

**Fix Strategy:**
```typescript
// api.ts — perbaiki error handling
if (!res.ok) {
  const text = await res.text();
  let message = `API Error ${res.status}`;
  try {
    const error = JSON.parse(text);
    if (error?.detail) {
      // Handle string detail
      if (typeof error.detail === 'string') {
        message = error.detail;
      }
      // Handle array detail (FastAPI validation errors)
      else if (Array.isArray(error.detail) && error.detail.length > 0) {
        message = error.detail[0]?.msg || error.detail[0]?.message || JSON.stringify(error.detail[0]);
      }
      // Handle object detail
      else if (typeof error.detail === 'object') {
        message = error.detail.msg || error.detail.message || JSON.stringify(error.detail);
      }
    }
  } catch {
    if (text) message = text;
  }
  throw new Error(String(message));
}
```

**Files to modify:**
1. `frontend/src/lib/api.ts` — apiFetch() function, lines 26-36

---

### BUG-03: nginx Override X-Forwarded-Proto (MEDIUM)

**Lokasi:** `nginx/nginx.conf` lines 46, 67

**Root Cause:**
```nginx
# nginx.conf line 46 & 67
proxy_set_header X-Forwarded-Proto $scheme;
```
`$scheme` selalu `http` karena nginx listen di port 80. Ini menimpa header `X-Forwarded-Proto: https` yang dikirim oleh CloudFlare, sehingga backend tidak tahu request aslinya via HTTPS.

**Fix Strategy:**
```nginx
# Ganti $scheme dengan $http_x_forwarded_proto
# nginx.conf line 46 & 67
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
```
Ini akan meneruskan header dari CloudFlare ke backend, dan fallback ke kosong jika tidak ada (yang akan dikenali sebagai HTTP oleh backend).

**Files to modify:**
1. `nginx/nginx.conf` — 2 location blocks (lines 46, 67)

---

### BUG-04: Empty Sales Rep Dropdown (MEDIUM — Data Issue)

**Lokasi:** Form `/opportunities/new`, Export Agent di `/agents`, Analytics `/analytics`

**Root Cause:**
Tidak ada user dengan role `sales` di database. Semua user (5) memiliki role `presales` atau `superadmin`. Sales Rep dropdown query user dengan role sales → kosong.

**Fix Strategy:**
1. **Data fix:** Admin buat user dengan role `sales` via Admin Panel (Assign Role → Sales)
2. **UX improvement:** Tambahkan empty state message di dropdown:
   - "Belum ada Sales Rep. Tambah user dengan role Sales di Admin Panel."

**Files to modify:**
1. `frontend/src/app/opportunities/new/page.tsx` — tambah empty state di Sales Rep dropdown
2. Opsional: Admin Panel → tambah opsi "Sales" di role selector

---

### BUG-05: RSC Prefetch Console Errors (LOW — Expected Behavior)

**Lokasi:** Next.js App Router prefetching

**Symptom:**
Console errors: "Failed to fetch RSC payload for /analytics. Falling back to browser navigation."

**Root Cause:**
Next.js App Router prefetches page data saat hover/focus pada link. Saat user navigasi sebelum prefetch selesai, request di-abort. Ini normal behavior, bukan bug.

**Fix Strategy:**
Tidak perlu code fix. Ini expected Next.js behavior. Error hanya muncul di console developer, tidak visible ke end user.

---

### BUG-06: @vite/client 404 (FALSE POSITIVE)

**Status:** BUKAN bug aplikasi. Request `/@vite/client` berasal dari TRAE browser tools yang inject script untuk HMR. Tidak muncul di browser user normal.

---

## Prioritas Perbaikan

| Priority | Bug | Effort | Impact |
|----------|-----|--------|--------|
| P0 | BUG-01: Secure Cookie | 30 menit | Login gagal via HTTP |
| P0 | BUG-03: nginx X-Forwarded-Proto | 5 menit | Backend tidak detect HTTPS |
| P1 | BUG-02: Error Display | 15 menit | UX error message |
| P2 | BUG-04: Sales Rep Dropdown | 20 menit | Data + UX |
| P3 | BUG-05: RSC Prefetch | — | No fix needed |

## Plan Eksekusi

### Step 1: Fix BUG-01 + BUG-03 (Cookie + nginx)
1. Edit `nginx/nginx.conf` — ganti `$scheme` → `$http_x_forwarded_proto` (2 lokasi)
2. Edit `backend/app/api/v1/auth.py` — tambah `Request` param, ganti `secure=not settings.DEBUG` → `secure=is_https` (2 lokasi: login + register)
3. Rebuild backend container
4. Test login via HTTP (harus work dengan DEBUG=false)

### Step 2: Fix BUG-02 (Error Display)
1. Edit `frontend/src/lib/api.ts` — perbaiki error handling untuk handle string/array/object detail
2. Rebuild frontend container
3. Test dengan invalid login credentials (harus show pesan error yang jelas)

### Step 3: Fix BUG-04 (Sales Rep)
1. Edit `frontend/src/app/opportunities/new/page.tsx` — tambah empty state message
2. Rebuild frontend
3. Admin Panel: buat user dengan role `sales` untuk testing

### Step 4: Cleanup
1. Revert `DEBUG=true` di NUC (sementara di-set untuk testing)
2. Set `DEBUG=false` kembali di `docker-compose.prod.yml` di NUC
3. Restart backend container
4. Verify login masih work via HTTP setelah BUG-01 fix diterapkan

## Catatan

- Perubahan `DEBUG=true` di NUC saat ini adalah **temporary fix**. Setelah BUG-01 diperbaiki, kembalikan ke `DEBUG=false`.
- Cloudflare tunnel tetap aktif. Setelah fix, login harus work baik via HTTP (direct NUC) maupun HTTPS (Cloudflare).
- Semua page berfungsi dengan baik secara fungsional. Responsive design bekerja dengan benar.
