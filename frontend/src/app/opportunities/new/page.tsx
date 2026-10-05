"use client";
import { useState, useEffect } from "react";
import { apiPost, apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Stage, User } from "@/types";
import { toast } from "sonner";

export default function NewOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [stages, setStages] = useState<Stage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    name: "",
    value: "",
    currency: "IDR",
    stage_id: "",
    close_date: "",
    source: "manual",
    owner_id: "",
    presales_id: "",
  });

  useEffect(() => {
    Promise.all([
      apiFetch<Stage[]>("/stages"),
      apiFetch<User[]>("/accounts/users/list"),
    ]).then(([s, u]) => {
      setStages(s.sort((a, b) => a.order - b.order));
      setUsers(u);
      // Default stage = Prospecting
      const prospecting = s.find((st) => st.order === 1);
      if (prospecting) setForm((prev) => ({ ...prev, stage_id: prospecting.id }));
    }).catch((err) => {
      console.error("Failed to fetch stages/users:", err);
      toast.error("Gagal memuat data stage dan user");
    }).finally(() => setDataLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.name.trim()) {
      toast.error("Nama opportunity wajib diisi");
      return;
    }
    const numValue = parseFloat(form.value);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error("Nilai deal harus angka positif");
      return;
    }
    if (!form.presales_id) {
      toast.error("Presales wajib dipilih");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/opportunities", {
        name: form.name.trim(),
        value: numValue,
        currency: form.currency,
        stage_id: form.stage_id || null,
        close_date: form.close_date || null,
        source: form.source,
        owner_id: form.owner_id || null,
        presales_id: form.presales_id || null,
      });
      toast.success("Opportunity berhasil dibuat");
      router.push("/opportunities");
    } catch (err) {
      toast.error("Gagal membuat: " + (err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/opportunities" className="flex items-center gap-2 text-muted hover:text-white text-sm">
        <ArrowLeft size={16} />
        Kembali ke Opportunities
      </Link>
      <Card>
        <CardHeader title="New Opportunity" subtitle="Buat opportunity baru secara manual" />
        <form onSubmit={handleSubmit} className="space-y-4">
          {dataLoading && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-sm text-primary flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Memuat data stage dan user...
            </div>
          )}
          <div>
            <label className="block text-sm text-muted mb-1.5">Nama Opportunity *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="contoh: PT Maju Jaya - CRM System"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Nilai Deal *</label>
              <input
                type="number"
                required
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="500000000"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted/60 mt-1">Estimasi nilai deal dalam mata uang yang dipilih</p>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Stage</label>
              <select
                value={form.stage_id}
                onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              >
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Close Date</label>
              <input
                type="date"
                value={form.close_date}
                onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted/60 mt-1">Estimasi tanggal deal akan ditutup</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Sales Rep (Owner)</label>
              <select
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              >
                <option value="">— Pilih Sales Rep —</option>
                {users.filter((u) => u.role === "sales_rep" || u.role === "sales_manager").length === 0 ? (
                  <option value="" disabled>Belum ada Sales Rep — tambah di Admin Panel</option>
                ) : (
                  users.filter((u) => u.role === "sales_rep" || u.role === "sales_manager").map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Presales *</label>
              <select
                required
                value={form.presales_id}
                onChange={(e) => setForm({ ...form, presales_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              >
                <option value="">— Pilih Presales —</option>
                {users.filter((u) => u.role === "presales").map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Sumber</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
            >
              <option value="manual">Manual</option>
              <option value="inbound">Inbound</option>
              <option value="referral">Referral</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-secondary disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Menyimpan..." : "Simpan Opportunity"}
            </button>
            <Link
              href="/opportunities"
              className="px-6 py-2.5 border border-border text-muted hover:text-white rounded-lg transition-colors"
            >
              Batal
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
