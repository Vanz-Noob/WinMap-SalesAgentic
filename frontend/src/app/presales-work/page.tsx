"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { PresalesWorkItem, PresalesWorkSummary, PresalesWorkTypeSummary, User, Opportunity } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  Boxes,
  FileText,
  FileSignature,
  FileStack,
  FlaskConical,
  Plus,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Trophy,
  ClipboardList,
  CheckCircle2,
  CircleDashed,
  RotateCcw,
  CalendarDays,
  User as UserIcon,
  Target,
  type LucideIcon,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  bom: Boxes,
  proposal_teknis: FileText,
  proposal_rfp: FileSignature,
  proposal_lainnya: FileStack,
  poc: FlaskConical,
};

const FALLBACK_TYPES: { key: string; label: string; description: string; icon: string; color: string }[] = [
  { key: "bom", label: "BOM", description: "Bill of Materials — rincian kebutuhan hardware/software", icon: "Boxes", color: "#3b82f6" },
  { key: "proposal_teknis", label: "Proposal Teknis", description: "Dokumen proposal teknis solusi & arsitektur", icon: "FileText", color: "#8b5cf6" },
  { key: "proposal_rfp", label: "Proposal RFP", description: "Jawaban RFP dari customer/principal", icon: "FileSignature", color: "#0d9488" },
  { key: "proposal_lainnya", label: "Proposal Lainnya", description: "Proposal komersial, RFQ, EOI, dll", icon: "FileStack", color: "#eab308" },
  { key: "poc", label: "POC", description: "Proof of Concept — demo/pilot solusi", icon: "FlaskConical", color: "#f97316" },
];

const STATUS_OPTIONS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
];

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  todo: { label: "To Do", color: "muted" },
  in_progress: { label: "In Progress", color: "primary" },
  review: { label: "Review", color: "warning" },
  done: { label: "Done", color: "success" },
};

const PRIORITY_BADGE: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "muted" },
  medium: { label: "Medium", color: "primary" },
  high: { label: "High", color: "warning" },
  urgent: { label: "Urgent", color: "danger" },
};

const OUTCOME_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "muted" },
  won: { label: "Close Won", color: "success" },
  lost: { label: "Close Lost", color: "danger" },
};

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors";
const SELECT_CLASS = INPUT_CLASS;
const TEXTAREA_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors resize-none";

// ── Helpers ────────────────────────────────────────────────────────────────

function getTypeMeta(key: string): { key: string; label: string; description: string; icon: string; color: string } {
  return FALLBACK_TYPES.find((t) => t.key === key) ?? { key, label: key, description: "", icon: "Boxes", color: "#3b82f6" };
}

function getTypeIcon(iconName: string): LucideIcon {
  return TYPE_ICON_MAP[iconName] ?? ClipboardList;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PresalesWorkPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";
  const isPresales = user?.role === "presales";
  const canAccess = isSuperadmin || isPresales;

  const [items, setItems] = useState<PresalesWorkItem[]>([]);
  const [summary, setSummary] = useState<PresalesWorkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [presalesUsers, setPresalesUsers] = useState<User[]>([]);
  const [selectedPresales, setSelectedPresales] = useState("all");

  // Opportunities for link dropdown
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  // Add/Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    opportunity_id: "",
    title: "",
    description: "",
    work_type: "bom",
    priority: "medium",
    status: "todo",
    due_date: "",
  });

  // Outcome modal (close won / close lost)
  const [outcomeTarget, setOutcomeTarget] = useState<{ id: string; title: string; outcome: "won" | "lost" } | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");

  // Delete inline confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Reopen inline confirm
  const [reopenId, setReopenId] = useState<string | null>(null);

  // Role-based filtering
  useEffect(() => {
    if (user && !isSuperadmin) setSelectedPresales(user.id);
  }, [user, isSuperadmin]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const effectivePresales = isSuperadmin ? selectedPresales : (user?.id ?? "all");
      if (effectivePresales !== "all") params.set("user_id", effectivePresales);
      const data = await apiFetch<PresalesWorkSummary>(`/presales-work/summary?${params.toString()}`);
      setSummary(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedPresales, isSuperadmin, user]);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const effectivePresales = isSuperadmin ? selectedPresales : (user?.id ?? "all");
      if (effectivePresales !== "all") params.set("user_id", effectivePresales);
      if (filterType !== "all") params.set("work_type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterOutcome !== "all") params.set("outcome", filterOutcome);
      const data = await apiFetch<PresalesWorkItem[]>(`/presales-work?${params.toString()}`);
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedPresales, filterType, filterStatus, filterOutcome, isSuperadmin, user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchSummary(), fetchItems()]);
  }, [fetchSummary, fetchItems]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Load presales users + opportunities (superadmin only for users)
  useEffect(() => {
    (async () => {
      try {
        const opps = await apiFetch<Opportunity[]>("/opportunities?limit=500");
        setOpportunities(opps);
      } catch {
        // optional — dropdown tetap kosong
      }
    })();
  }, []);

  useEffect(() => {
    if (!isSuperadmin) return;
    (async () => {
      try {
        const users = await apiFetch<User[]>("/accounts/users/list");
        setPresalesUsers(users.filter((u) => u.role === "presales"));
      } catch {
        // silently ignore
      }
    })();
  }, [isSuperadmin]);

  // ── Form Actions ─────────────────────────────────────────────────────────

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      user_id: isSuperadmin ? "" : (user?.id ?? ""),
      opportunity_id: "",
      title: "",
      description: "",
      work_type: filterType !== "all" ? filterType : "bom",
      priority: "medium",
      status: "todo",
      due_date: "",
    });
    setShowForm(true);
  };

  const openEditForm = (item: PresalesWorkItem) => {
    setEditingId(item.id);
    setFormData({
      user_id: item.user_id ?? "",
      opportunity_id: item.opportunity_id ?? "",
      title: item.title,
      description: item.description ?? "",
      work_type: item.work_type,
      priority: item.priority,
      status: item.status,
      due_date: item.due_date ?? "",
    });
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        opportunity_id: formData.opportunity_id || null,
        title: formData.title,
        description: formData.description || null,
        work_type: formData.work_type,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date || null,
      };
      if (editingId) {
        await apiPatch<PresalesWorkItem>(`/presales-work/${editingId}`, payload);
        toast.success("Pekerjaan berhasil diperbarui");
      } else {
        if (isSuperadmin) payload.user_id = formData.user_id || undefined;
        await apiPost<PresalesWorkItem>("/presales-work", payload);
        toast.success("Pekerjaan baru berhasil dibuat");
      }
      setShowForm(false);
      await refreshAll();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Outcome Actions ──────────────────────────────────────────────────────

  const openOutcomeModal = (id: string, title: string, outcome: "won" | "lost") => {
    setOutcomeTarget({ id, title, outcome });
    setOutcomeNotes("");
  };

  const handleOutcomeSubmit = async () => {
    if (!outcomeTarget) return;
    setSubmitting(true);
    try {
      await apiPatch<PresalesWorkItem>(`/presales-work/${outcomeTarget.id}`, {
        outcome: outcomeTarget.outcome,
        outcome_notes: outcomeNotes || null,
      });
      toast.success(
        outcomeTarget.outcome === "won" ? `🎉 "${outcomeTarget.title}" ditandai Close Won` : `"${outcomeTarget.title}" ditandai Close Lost`
      );
      setOutcomeTarget(null);
      await refreshAll();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (id: string) => {
    setSubmitting(true);
    try {
      await apiPatch<PresalesWorkItem>(`/presales-work/${id}`, { outcome: "pending", outcome_notes: null });
      toast.success("Pekerjaan dibuka kembali (outcome: pending)");
      setReopenId(null);
      await refreshAll();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await apiDelete(`/presales-work/${id}`);
      toast.success("Pekerjaan dihapus");
      setDeleteId(null);
      if (editingId === id) setShowForm(false);
      await refreshAll();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived Data ─────────────────────────────────────────────────────────

  const typeOptions = summary?.work_types ?? FALLBACK_TYPES.map((t) => ({ ...t, total: 0, todo: 0, in_progress: 0, review: 0, done: 0, won: 0, lost: 0, overdue: 0 })) as unknown as PresalesWorkTypeSummary[];

  const stats = useMemo(() => ({
    total: summary?.total ?? 0,
    todo: summary?.total_todo ?? 0,
    inProgress: summary?.total_in_progress ?? 0,
    review: summary?.total_review ?? 0,
    done: summary?.total_done ?? 0,
    won: summary?.total_won ?? 0,
    lost: summary?.total_lost ?? 0,
    pending: summary?.total_pending ?? 0,
    overdue: summary?.total_overdue ?? 0,
    winRate: summary?.win_rate ?? 0,
  }), [summary]);

  const selectedPresalesName =
    isSuperadmin && selectedPresales !== "all"
      ? presalesUsers.find((u) => u.id === selectedPresales)?.name ?? undefined
      : undefined;

  // ── Access Control ───────────────────────────────────────────────────────

  if (user && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={36} className="text-danger" />
        <p className="text-danger text-sm font-medium">Akses Ditolak</p>
        <p className="text-muted text-sm text-center max-w-md">
          Tracking pekerjaan hanya untuk role <span className="text-foreground font-medium">presales</span> dan{" "}
          <span className="text-foreground font-medium">superadmin</span>. Role Anda (
          <span className="text-foreground font-medium">{user.role}</span>) tidak memiliki akses.
        </p>
      </div>
    );
  }

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={36} className="text-primary animate-spin" />
        <p className="text-muted text-sm">Memuat data pekerjaan presales...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Tracking Pekerjaan Presales</h1>
          <p className="text-sm text-muted mt-1">
            Lacak BOM, proposal &amp; POC — sampai close won / close lost
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperadmin && (
            <select
              value={selectedPresales}
              onChange={(e) => setSelectedPresales(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
            >
              <option value="all">Semua Presales</option>
              {presalesUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Semua Jenis</option>
            {FALLBACK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Semua Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="all">Semua Outcome</option>
            <option value="pending">Pending</option>
            <option value="won">Close Won</option>
            <option value="lost">Close Lost</option>
          </select>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="flex items-center gap-2 border border-border text-muted hover:text-foreground hover:border-primary px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
          >
            <Plus size={15} />
            <span>Pekerjaan</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0" />
          <p className="text-danger text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-danger/70 hover:text-danger">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Summary Stats + Win Rate */}
      <Card>
        <div className="p-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Ringkasan Pekerjaan</h3>
              <p className="text-xs text-muted mt-0.5">
                {selectedPresalesName ? selectedPresalesName + " • " : ""}{stats.total} total pekerjaan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-success" />
              <div className="text-right">
                <p className="text-xl font-bold text-success leading-none">{stats.winRate}%</p>
                <p className="text-[10px] text-muted uppercase tracking-wide">Win Rate</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted">To Do</p>
              <p className="text-lg font-bold text-muted">{stats.todo}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted">In Progress</p>
              <p className="text-lg font-bold text-primary">{stats.inProgress}</p>
            </div>
            <div className="bg-warning/5 rounded-lg p-3 border border-warning/20">
              <p className="text-xs text-muted">Review</p>
              <p className="text-lg font-bold text-warning">{stats.review}</p>
            </div>
            <div className="bg-success/5 rounded-lg p-3 border border-success/20">
              <p className="text-xs text-muted">Close Won</p>
              <p className="text-lg font-bold text-success">{stats.won}</p>
            </div>
            <div className="bg-danger/5 rounded-lg p-3 border border-danger/20">
              <p className="text-xs text-muted">Close Lost</p>
              <p className="text-lg font-bold text-danger">{stats.lost}</p>
            </div>
            <div className="bg-warning/5 rounded-lg p-3 border border-warning/20">
              <p className="text-xs text-muted">Overdue</p>
              <p className="text-lg font-bold text-warning">{stats.overdue}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Per-type Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {typeOptions.map((t) => {
          const Icon = getTypeIcon(t.icon);
          const color = t.color || "#3b82f6";
          const progress = t.total > 0 ? ((t.done / t.total) * 100) : 0;
          return (
            <Card key={t.key} className="p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}22`, color }}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.label}</p>
                  <p className="text-[10px] text-muted">{t.total} pekerjaan</p>
                </div>
              </div>
              <div className="h-1.5 bg-background rounded-full overflow-hidden mb-2.5">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: color }} />
              </div>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-primary">Berjalan: <span className="font-medium">{t.in_progress}</span></span>
                <span className="text-success">Won: <span className="font-medium">{t.won}</span></span>
                <span className="text-danger">Lost: <span className="font-medium">{t.lost}</span></span>
                {t.overdue > 0 && <span className="text-warning">Overdue: <span className="font-medium">{t.overdue}</span></span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 4. Work List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          Daftar Pekerjaan
          <span className="text-muted font-normal">({items.length})</span>
        </h2>

        {items.length === 0 && !loading && (
          <Card>
            <div className="text-center py-10">
              <ClipboardList size={36} className="mx-auto text-muted mb-3" />
              <p className="text-muted text-sm mb-1">Belum ada pekerjaan</p>
              <p className="text-xs text-muted mb-4">
                {filterType !== "all" || filterStatus !== "all" || filterOutcome !== "all"
                  ? "Tidak ada pekerjaan yang cocok dengan filter."
                  : "Buat pekerjaan pertama Anda — BOM, proposal, atau POC."}
              </p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                Tambah Pekerjaan
              </button>
            </div>
          </Card>
        )}

        {items.map((item) => {
          const tMeta = getTypeMeta(item.work_type);
          const TIcon = getTypeIcon(tMeta.icon);
          const stBadge = STATUS_BADGE[item.status] ?? STATUS_BADGE.todo;
          const prBadge = PRIORITY_BADGE[item.priority] ?? PRIORITY_BADGE.medium;
          const ocBadge = OUTCOME_BADGE[item.outcome] ?? OUTCOME_BADGE.pending;

          // ── Delete confirmation row ──
          if (deleteId === item.id) {
            return (
              <Card key={item.id} className="bg-danger/5 border-danger/30">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={16} className="text-danger shrink-0" />
                    <p className="text-sm text-foreground truncate">
                      Hapus &ldquo;{item.title}&rdquo;?
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={submitting}
                      className="bg-danger hover:bg-danger/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Menghapus..." : "Hapus"}
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="border border-border text-muted hover:text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </Card>
            );
          }

          // ── Reopen confirmation row ──
          if (reopenId === item.id) {
            return (
              <Card key={item.id} className="bg-warning/5 border-warning/30">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw size={16} className="text-warning shrink-0" />
                    <p className="text-sm text-foreground truncate">
                      Buka kembali &ldquo;{item.title}&rdquo;? Outcome akan direset ke pending.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleReopen(item.id)}
                      disabled={submitting}
                      className="bg-warning hover:bg-warning/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Memproses..." : "Buka Kembali"}
                    </button>
                    <button
                      onClick={() => setReopenId(null)}
                      className="border border-border text-muted hover:text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </Card>
            );
          }

          // ── Default item card ──
          return (
            <Card key={item.id} className="p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${tMeta.color}22`, color: tMeta.color }}
                    title={tMeta.label}
                  >
                    <TIcon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <Badge label={tMeta.label} color="primary" />
                      {item.is_overdue && <Badge label="Overdue" color="danger" />}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <UserIcon size={12} />
                        {item.user_name ?? "Tanpa PIC"}
                      </span>
                      {item.opportunity_name && (
                        <span className="flex items-center gap-1">
                          <Target size={12} />
                          {item.opportunity_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        Due: {formatDate(item.due_date)}
                      </span>
                      {item.completed_at && (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 size={12} />
                          Selesai: {formatDate(item.completed_at)}
                        </span>
                      )}
                    </div>
                    {item.outcome_notes && (
                      <p className="text-xs text-muted mt-1.5 italic line-clamp-2">
                        Catatan outcome: &ldquo;{item.outcome_notes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge label={stBadge.label} color={stBadge.color} />
                    <Badge label={prBadge.label} color={prBadge.color} />
                    <Badge label={ocBadge.label} color={ocBadge.color} />
                  </div>

                  {/* Outcome actions */}
                  {item.outcome === "pending" ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openOutcomeModal(item.id, item.title, "won")}
                        disabled={submitting}
                        className="flex items-center gap-1 bg-success/10 hover:bg-success/20 text-success text-xs font-medium px-2.5 py-1.5 rounded-lg border border-success/30 transition-colors disabled:opacity-50"
                        title="Tandai Close Won"
                      >
                        <Trophy size={13} />
                        Close Won
                      </button>
                      <button
                        onClick={() => openOutcomeModal(item.id, item.title, "lost")}
                        disabled={submitting}
                        className="flex items-center gap-1 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-medium px-2.5 py-1.5 rounded-lg border border-danger/30 transition-colors disabled:opacity-50"
                        title="Tandai Close Lost"
                      >
                        <CircleDashed size={13} />
                        Close Lost
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReopenId(item.id)}
                      disabled={submitting}
                      className="flex items-center gap-1 text-xs text-muted hover:text-warning border border-border hover:border-warning/40 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      title="Buka kembali (reset outcome)"
                    >
                      <RotateCcw size={13} />
                      Buka Kembali
                    </button>
                  )}

                  {/* Edit / Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditForm(item)}
                      className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 5. Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !submitting && setShowForm(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-lg p-5 md:p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {editingId ? "Edit Pekerjaan" : "Tambah Pekerjaan"}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {editingId ? "Perbarui detail pekerjaan presales" : "Buat pekerjaan baru: BOM, proposal, atau POC"}
                </p>
              </div>
              <button
                onClick={() => !submitting && setShowForm(false)}
                className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-border/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Assign PIC — superadmin only */}
              {isSuperadmin && !editingId && (
                <div>
                  <label className="block text-xs text-muted mb-1.5">Assign PIC *</label>
                  <select
                    required
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>Pilih presales...</option>
                    {presalesUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1.5">Jenis Pekerjaan *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FALLBACK_TYPES.map((t) => {
                    const Icon = getTypeIcon(t.icon);
                    const active = formData.work_type === t.key;
                    return (
                      <button
                        type="button"
                        key={t.key}
                        onClick={() => setFormData({ ...formData, work_type: t.key })}
                        title={t.description}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted hover:text-foreground hover:border-primary/50"
                        )}
                      >
                        <Icon size={14} className="shrink-0" />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Judul Pekerjaan *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="cth: BOM Network Upgrade Bank Mandiri"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Deskripsi</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detail pekerjaan, scope, catatan teknis..."
                  className={TEXTAREA_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Link Opportunity</label>
                <select
                  value={formData.opportunity_id}
                  onChange={(e) => setFormData({ ...formData, opportunity_id: e.target.value })}
                  className={SELECT_CLASS}
                >
                  <option value="">— Tidak terkait opportunity —</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1.5">Prioritas</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-secondary text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Buat Pekerjaan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-6 py-2.5 border border-border text-muted hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Outcome Modal (Close Won / Close Lost) */}
      {outcomeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !submitting && setOutcomeTarget(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-md p-5 md:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    outcomeTarget.outcome === "won" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                  )}
                >
                  {outcomeTarget.outcome === "won" ? <Trophy size={20} /> : <CircleDashed size={20} />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {outcomeTarget.outcome === "won" ? "Close Won" : "Close Lost"}
                  </h2>
                  <p className="text-xs text-muted mt-0.5 truncate max-w-[240px]">{outcomeTarget.title}</p>
                </div>
              </div>
              <button
                onClick={() => !submitting && setOutcomeTarget(null)}
                className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-border/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted mb-4">
              {outcomeTarget.outcome === "won"
                ? "Pekerjaan ini berhasil — status otomatis jadi Done dan tanggal selesai dicatat."
                : "Pekerjaan ini tidak berhasil — status otomatis jadi Done dan tanggal selesai dicatat."}
            </p>

            <div className="mb-5">
              <label className="block text-xs text-muted mb-1.5">Catatan Outcome (opsional)</label>
              <textarea
                rows={3}
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder={
                  outcomeTarget.outcome === "won"
                    ? "cth: Proposal diterima customer, kontrak ditandatangani..."
                    : "cth: Kalah dari kompetitor, budget customer dipotong..."
                }
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleOutcomeSubmit}
                disabled={submitting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50",
                  outcomeTarget.outcome === "won" ? "bg-success hover:bg-success/80" : "bg-danger hover:bg-danger/80"
                )}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : outcomeTarget.outcome === "won" ? <Trophy size={16} /> : <CircleDashed size={16} />}
                {submitting ? "Memproses..." : outcomeTarget.outcome === "won" ? "Ya, Close Won" : "Ya, Close Lost"}
              </button>
              <button
                onClick={() => setOutcomeTarget(null)}
                disabled={submitting}
                className="px-6 py-2.5 border border-border text-muted hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
