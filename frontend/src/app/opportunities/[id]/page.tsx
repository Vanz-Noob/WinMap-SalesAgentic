"use client";
import { useEffect, useState } from "react";
import { apiFetch, apiPatch, apiPost } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import type { Opportunity, Stage, Activity, User } from "@/types";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", value: "", stage_id: "", win_probability: "", close_date: "", owner_id: ""
  });

  // Form tambah aktivitas
  const [newActivity, setNewActivity] = useState({ type: "call", description: "" });
  const [addingActivity, setAddingActivity] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<Opportunity>(`/opportunities/${id}`),
      apiFetch<Stage[]>("/stages"),
      apiFetch<Activity[]>(`/activities?opp_id=${id}`),
      apiFetch<User[]>("/accounts/users/list"),
    ]).then(([o, s, a, u]) => {
      setOpp(o);
      setStages(s.sort((a, b) => a.order - b.order));
      setActivities(a);
      setUsers(u);
      setEditForm({
        name: o.name,
        value: String(o.value),
        stage_id: o.stage_id || "",
        win_probability: String(Math.round(o.win_probability * 100)),
        close_date: o.close_date ? o.close_date.split("T")[0] : "",
        owner_id: o.owner_id || "",
      });
    }).catch((err) => {
      console.error("Failed to fetch opportunity detail:", err);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!opp) return;
    try {
      const winProb = parseFloat(editForm.win_probability) / 100;
      const clampedProb = Math.max(0, Math.min(1, winProb));

      // Cek apakah win probability berubah dari nilai asli
      const winProbChanged = Math.round(clampedProb * 100) !== Math.round(opp.win_probability * 100);

      // Bangun payload: jika win_prob berubah, jangan kirim stage_id
      // agar backend auto-assign stage berdasarkan threshold
      const payload: Record<string, unknown> = {
        name: editForm.name,
        value: parseFloat(editForm.value),
        win_probability: clampedProb,
        close_date: editForm.close_date || null,
        owner_id: editForm.owner_id || null,
      };

      if (!winProbChanged) {
        // Hanya kirim stage_id jika win_prob tidak berubah
        payload.stage_id = editForm.stage_id || null;
      }

      const updated = await apiPatch<Opportunity>(`/opportunities/${opp.id}`, payload);
      setOpp(updated);
      setEditing(false);
      toast.success("Opportunity berhasil diperbarui");
    } catch (err) {
      toast.error("Gagal update: " + (err as Error).message);
    }
  };

  const handleAddActivity = async () => {
    if (!opp || !newActivity.description.trim()) return;
    setAddingActivity(true);
    try {
      const created = await apiPost<Activity>("/activities", {
        opp_id: opp.id,
        type: newActivity.type,
        description: newActivity.description,
      });
      setActivities((prev) => [created, ...prev]);
      setNewActivity({ type: "call", description: "" });
      toast.success("Aktivitas berhasil ditambahkan");
    } catch (err) {
      toast.error("Gagal menambah aktivitas: " + (err as Error).message);
    } finally {
      setAddingActivity(false);
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
  if (!opp) return <div className="text-muted text-center py-12">Opportunity not found</div>;

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const owner = users.find((u) => u.id === opp.owner_id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/opportunities" className="flex items-center gap-2 text-muted hover:text-white text-sm">
        <ArrowLeft size={16} /> Kembali ke Opportunities
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="lg:col-span-2">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{opp.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge label={opp.currency} color="muted" />
                {opp.source === "ai_agent" && <Badge label="AI Created" color="accent" />}
                {owner && <Badge label={`👤 ${owner.name}`} color="primary" />}
              </div>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="text-primary hover:text-secondary text-sm font-medium">
                ✏️ Edit
              </button>
            ) : (
              <button onClick={handleSave} className="flex items-center gap-1.5 text-success hover:text-accent text-sm font-medium">
                <Save size={14} /> Simpan
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <p className="text-xs text-muted uppercase mb-1">Nama Opportunity</p>
              {!editing ? (
                <p className="text-white font-medium">{opp.name}</p>
              ) : (
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white" />
              )}
            </div>

            {/* Value */}
            <div>
              <p className="text-xs text-muted uppercase mb-1">Nilai Deal</p>
              {!editing ? (
                <p className="text-2xl font-bold text-white">{formatCurrency(opp.value, opp.currency)}</p>
              ) : (
                <input type="number" min="0" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white" />
              )}
            </div>

            {/* Win Probability */}
            <div>
              <p className="text-xs text-muted uppercase mb-1">Win Probability (%)</p>
              {!editing ? (
                <p className="text-2xl font-bold text-primary">{Math.round(opp.win_probability * 100)}%</p>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" step="1" min="0" max="100" value={editForm.win_probability}
                    onChange={(e) => setEditForm({ ...editForm, win_probability: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white" />
                  <span className="text-muted text-lg">%</span>
                </div>
              )}
              {editing && (
                <p className="text-xs text-muted/70 mt-1">Otomatis pindah stage: ≤10% Prospecting, 11-25% Qualification, 26-50% Proposal, 51-70% Negotiation, 71-100% Closed Won</p>
              )}
            </div>

            {/* Stage */}
            <div>
              <p className="text-xs text-muted uppercase mb-1">Stage</p>
              {!editing ? (
                <p className="text-white">{stageMap.get(opp.stage_id || "")?.name || "Unknown"}</p>
              ) : (
                <select value={editForm.stage_id} onChange={(e) => setEditForm({ ...editForm, stage_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white">
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Close Date */}
            <div>
              <p className="text-xs text-muted uppercase mb-1">Close Date</p>
              {!editing ? (
                <p className="text-white">{formatDate(opp.close_date)}</p>
              ) : (
                <input type="date" value={editForm.close_date} onChange={(e) => setEditForm({ ...editForm, close_date: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white" />
              )}
            </div>

            {/* Owner */}
            <div className="col-span-2">
              <p className="text-xs text-muted uppercase mb-1">Sales Rep (Owner)</p>
              {!editing ? (
                <p className="text-white">{owner?.name || "Unassigned"}</p>
              ) : (
                <select value={editForm.owner_id} onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white">
                  <option value="">— Unassigned —</option>
                  {users.filter((u) => u.role === "sales_rep").map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>

        {/* Sidebar Info */}
        <Card>
          <CardHeader title="Detail" />
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted">Created</p>
              <p className="text-white">{formatDateTime(opp.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Last Updated</p>
              <p className="text-white">{formatDateTime(opp.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Sumber</p>
              <p className="text-white">{opp.source || "manual"}</p>
            </div>
            {opp.ai_metadata && (
              <div>
                <p className="text-xs text-muted">AI Metadata</p>
                <pre className="text-xs text-white bg-background p-2 rounded-lg overflow-x-auto max-h-48">
                  {JSON.stringify(opp.ai_metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Activities */}
      <Card>
        <CardHeader title="Aktivitas" subtitle={`${activities.length} aktivitas tercatat`} />

        {/* Add Activity Form */}
        <div className="flex gap-2 mb-4 pb-4 border-b border-border">
          <select
            value={newActivity.type}
            onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="call">📞 Call</option>
            <option value="email">✉️ Email</option>
            <option value="meeting">📅 Meeting</option>
            <option value="note">📝 Note</option>
          </select>
          <input
            type="text"
            value={newActivity.description}
            onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
            placeholder="Deskripsi aktivitas..."
            onKeyDown={(e) => { if (e.key === "Enter") handleAddActivity(); }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAddActivity}
            disabled={addingActivity || !newActivity.description.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-secondary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {addingActivity ? "..." : "Tambah"}
          </button>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-muted text-center py-4">Belum ada aktivitas</p>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="flex gap-3 items-start border-b border-border/50 pb-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs text-primary font-medium uppercase">{act.type[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge label={act.type} color="primary" />
                    <span className="text-xs text-muted">{formatDateTime(act.created_at)}</span>
                  </div>
                  <p className="text-sm text-white mt-1">{act.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
