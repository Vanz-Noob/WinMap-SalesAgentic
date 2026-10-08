"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PresalesKpiSummary, PresalesKpiItem, User } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  Package,
  Megaphone,
  Award,
  Handshake,
  TrendingUp,
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Gauge,
  type LucideIcon,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const YEARS = [2025, 2026];

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  bundling_solution: Package,
  marketing_activities: Megaphone,
  certification: Award,
  relationship_principal: Handshake,
  upselling_cross_selling: TrendingUp,
  response_time: Clock,
};

const FALLBACK_CATEGORIES: {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  { key: "bundling_solution", label: "Bundling Solution", description: "Create and deliver bundled solution packages", icon: "Package", color: "#3b82f6" },
  { key: "marketing_activities", label: "Marketing Activities", description: "Execute presales marketing and demos", icon: "Megaphone", color: "#0d9488" },
  { key: "certification", label: "Certification", description: "Achieve product and technical certifications", icon: "Award", color: "#eab308" },
  { key: "relationship_principal", label: "Relationship Principal", description: "Build and nurture principal relationships", icon: "Handshake", color: "#059669" },
  { key: "upselling_cross_selling", label: "Upselling & Cross-selling", description: "Drive upsell and cross-sell motions", icon: "TrendingUp", color: "#8b5cf6" },
  { key: "response_time", label: "Response Time", description: "Meet presales response time SLAs", icon: "Clock", color: "#ef4444" },
];

interface StatusStyle {
  text: string;
  bg: string;
  hex: string;
  badge: string;
  label: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  achieved: { text: "text-success", bg: "bg-success", hex: "#059669", badge: "success", label: "Achieved" },
  in_progress: { text: "text-primary", bg: "bg-primary", hex: "#3b82f6", badge: "primary", label: "In Progress" },
  overdue: { text: "text-danger", bg: "bg-danger", hex: "#ef4444", badge: "danger", label: "Overdue" },
  not_started: { text: "text-muted", bg: "bg-muted", hex: "#94a3b8", badge: "muted", label: "Not Started" },
};

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors";
const SELECT_CLASS = INPUT_CLASS;
const TEXTAREA_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-foreground placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors resize-none";

// ── Helpers ────────────────────────────────────────────────────────────────

function getCategoryIcon(key: string, iconName?: string): LucideIcon {
  if (key && CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  if (iconName && CATEGORY_ICON_MAP[iconName.toLowerCase()]) return CATEGORY_ICON_MAP[iconName.toLowerCase()];
  return Gauge;
}

function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES.not_started;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#eab308";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Needs Attention";
  return "Critical";
}

/** Auto-calculate status from actual vs target ratio */
function autoCalculateStatus(actual: number, target: number): string {
  if (target > 0 && actual >= target) return "achieved";
  if (actual > 0) return "in_progress";
  return "not_started";
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({
  value,
  color,
  className,
}: {
  value: number;
  color: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 bg-background rounded-full overflow-hidden", className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)` }}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PresalesKpiPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";
  const isPresales = user?.role === "presales";
  const canAccess = isSuperadmin || isPresales;

  const [summary, setSummary] = useState<PresalesKpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quarter, setQuarter] = useState("Q3");
  const [year, setYear] = useState(2026);
  const [presalesUsers, setPresalesUsers] = useState<User[]>([]);
  const [selectedPresales, setSelectedPresales] = useState("all");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Simplified form data — removed description, unit, status (auto-calculated)
  const [formData, setFormData] = useState({
    user_id: "",
    category: "",
    item_name: "",
    target: "",
    actual: "",
    notes: "",
  });

  // Simplified edit data — removed status (auto-calculated)
  const [editData, setEditData] = useState({
    target: "",
    actual: "",
    notes: "",
  });

  // Role-based filtering: presales users only see their own data; superadmin sees all
  useEffect(() => {
    if (user && !isSuperadmin) {
      setSelectedPresales(user.id);
    }
  }, [user, isSuperadmin]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("quarter", quarter);
      params.set("year", String(year));
      // Presales users always filter by own user_id; superadmin can filter by selected
      const effectivePresales = isSuperadmin ? selectedPresales : (user?.id ?? "all");
      if (effectivePresales !== "all") {
        params.set("user_id", effectivePresales);
      }
      const data = await apiFetch<PresalesKpiSummary>(
        `/presales-kpi/summary?${params.toString()}`
      );
      setSummary(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [quarter, year, selectedPresales, isSuperadmin, user]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch presales users for filter dropdown (superadmin only)
  useEffect(() => {
    if (!isSuperadmin) return;
    (async () => {
      try {
        const users = await apiFetch<User[]>("/accounts/users/list");
        setPresalesUsers(users.filter((u) => u.role === "presales"));
      } catch {
        // silently ignore — filter just won't have options
      }
    })();
  }, [isSuperadmin]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const categoryOptions = summary?.categories ?? FALLBACK_CATEGORIES;

  const openAddForm = () => {
    const cats = summary?.categories ?? FALLBACK_CATEGORIES;
    setFormData({
      user_id: isSuperadmin ? "" : (user?.id ?? ""),
      category: cats[0]?.key ?? "",
      item_name: "",
      target: "",
      actual: "",
      notes: "",
    });
    setShowAddForm(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const actualNum = Number(formData.actual) || 0;
      const targetNum = Number(formData.target) || 0;
      const status = autoCalculateStatus(actualNum, targetNum);
      await apiPost<PresalesKpiItem>("/presales-kpi", {
        user_id: isSuperadmin ? (formData.user_id || undefined) : undefined,
        category: formData.category,
        item_name: formData.item_name,
        target: targetNum,
        actual: actualNum,
        quarter,
        year,
        status,
        notes: formData.notes || null,
      });
      setShowAddForm(false);
      await fetchSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: PresalesKpiItem) => {
    setEditingId(item.id);
    setDeleteId(null);
    setEditData({
      target: String(item.target),
      actual: String(item.actual),
      notes: item.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditSubmit = async (id: string) => {
    setSubmitting(true);
    try {
      const actualNum = Number(editData.actual) || 0;
      const targetNum = Number(editData.target) || 0;
      const status = autoCalculateStatus(actualNum, targetNum);
      await apiPatch<PresalesKpiItem>(`/presales-kpi/${id}`, {
        actual: actualNum,
        target: targetNum,
        status,
        notes: editData.notes || null,
      });
      setEditingId(null);
      await fetchSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await apiDelete(`/presales-kpi/${id}`);
      setDeleteId(null);
      if (editingId === id) setEditingId(null);
      await fetchSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived Data ─────────────────────────────────────────────────────────

  const selectedPresalesName =
    selectedPresales !== "all"
      ? presalesUsers.find((u) => u.id === selectedPresales)?.name ?? "My KPIs"
      : undefined;

  const overallScore = summary?.overall_score ?? 0;
  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore);
  const totalItems = summary?.total_items ?? 0;
  const totalAchieved = summary?.total_achieved ?? 0;
  const totalInProgress = summary?.total_in_progress ?? 0;
  const totalOverdue = summary?.total_overdue ?? 0;

  // ── Access Control ─────────────────────────────────────────────────────

  if (user && !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={36} className="text-danger" />
        <p className="text-danger text-sm font-medium">Akses Ditolak</p>
        <p className="text-muted text-sm text-center max-w-md">
          Presales tracking hanya untuk role <span className="text-foreground font-medium">presales</span> dan{" "}
          <span className="text-foreground font-medium">superadmin</span>. Role Anda (
          <span className="text-foreground font-medium">{user.role}</span>) tidak memiliki akses.
        </p>
      </div>
    );
  }

  // ── Initial Loading ──────────────────────────────────────────────────────

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={36} className="text-primary animate-spin" />
        <p className="text-muted text-sm">Loading presales KPI data...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* 1. Header — mobile responsive */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Presales KPI Tracking</h1>
          <p className="text-sm text-muted mt-1">
            Track and monitor presales performance across 6 key categories
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Presales filter — only for superadmin */}
          {isSuperadmin && (
            <select
              value={selectedPresales}
              onChange={(e) => setSelectedPresales(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
            >
              <option value="all">All Presales</option>
              {presalesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            {QUARTERS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary"
          >
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <button
            onClick={fetchSummary}
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
            <span>Add KPI</span>
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

      {/* 2. Compact Overall Score — replaces bulky gauge + gradient cards */}
      <Card>
        <div className="p-4 md:p-5">
          {/* Score + progress bar */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Overall Presales Score</h3>
              <p className="text-xs text-muted mt-0.5">
                {selectedPresalesName ? selectedPresalesName + " • " : ""}
                {summary?.quarter ?? quarter} {summary?.year ?? year}
              </p>
            </div>
            <Badge label={scoreLabel} color={overallScore >= 50 ? "success" : "danger"} />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl font-bold text-foreground">{overallScore}</span>
            <div className="flex-1">
              <ProgressBar value={overallScore} color={scoreColor} className="h-2.5" />
              <span className="text-xs text-muted mt-1 block">out of 100</span>
            </div>
          </div>

          {/* Compact stat tiles — no gradients, just numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="bg-background rounded-lg p-3 border border-border">
              <p className="text-xs text-muted">Total Items</p>
              <p className="text-lg font-bold text-foreground">{totalItems}</p>
            </div>
            <div className="bg-success/5 rounded-lg p-3 border border-success/20">
              <p className="text-xs text-muted">Achieved</p>
              <p className="text-lg font-bold text-success">{totalAchieved}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted">In Progress</p>
              <p className="text-lg font-bold text-primary">{totalInProgress}</p>
            </div>
            <div className="bg-danger/5 rounded-lg p-3 border border-danger/20">
              <p className="text-xs text-muted">Overdue</p>
              <p className="text-lg font-bold text-danger">{totalOverdue}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Category Breakdown — compact layout with progress bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(summary?.categories ?? []).map((cat) => {
          const Icon = getCategoryIcon(cat.key, cat.icon);
          const catColor = cat.color || "#3b82f6";
          return (
            <Card key={cat.key}>
              <div className="p-4">
                {/* Compact category header with inline progress */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${catColor}22`, color: catColor }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">{cat.label}</h3>
                      <span className="text-sm font-medium shrink-0" style={{ color: catColor }}>
                        {Math.round(cat.avg_progress)}%
                      </span>
                    </div>
                    <ProgressBar value={cat.avg_progress} color={catColor} className="mt-1.5" />
                  </div>
                </div>

                {/* Compact category stats */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className="text-muted">Total: <span className="text-foreground font-medium">{cat.total_items}</span></span>
                  <span className="text-success">Done: <span className="font-medium">{cat.achieved_items}</span></span>
                  <span className="text-primary">Progress: <span className="font-medium">{cat.in_progress_items}</span></span>
                  {cat.overdue_items > 0 && (
                    <span className="text-danger">Overdue: <span className="font-medium">{cat.overdue_items}</span></span>
                  )}
                </div>

                {/* KPI items list — compact rows */}
                <div className="space-y-2">
                  {cat.items.length === 0 && (
                    <div className="text-center py-4 text-muted text-sm">
                      No KPI items in this category yet.
                    </div>
                  )}
                  {cat.items.map((item) => {
                    const st = getStatusStyle(item.status);
                    const autoStatus = autoCalculateStatus(item.actual, item.target);
                    const autoSt = getStatusStyle(autoStatus);

                    // ── Edit mode ──
                    if (editingId === item.id) {
                      return (
                        <div
                          key={item.id}
                          className="bg-background border border-primary/40 rounded-lg p-3 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">{item.item_name}</p>
                            <Pencil size={14} className="text-primary" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-muted mb-1">Target</label>
                              <input
                                type="number"
                                value={editData.target}
                                onChange={(e) => setEditData({ ...editData, target: e.target.value })}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted mb-1">Actual</label>
                              <input
                                type="number"
                                value={editData.actual}
                                onChange={(e) => setEditData({ ...editData, actual: e.target.value })}
                                className={INPUT_CLASS}
                              />
                            </div>
                          </div>
                          {/* Auto-status indicator */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Auto Status:</span>
                            <Badge label={autoSt.label} color={autoSt.badge} />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">Notes</label>
                            <textarea
                              rows={2}
                              value={editData.notes}
                              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                              className={TEXTAREA_CLASS}
                              placeholder="Add notes..."
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleEditSubmit(item.id)}
                              disabled={submitting}
                              className="flex items-center gap-1.5 bg-primary hover:bg-secondary text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              {submitting ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1.5 border border-border text-muted hover:text-foreground px-3 py-2 rounded-lg text-sm transition-colors"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // ── Delete confirmation ──
                    if (deleteId === item.id) {
                      return (
                        <div
                          key={item.id}
                          className="bg-danger/5 border border-danger/30 rounded-lg p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle size={16} className="text-danger shrink-0" />
                            <p className="text-xs text-foreground truncate">
                              Delete &ldquo;{item.item_name}&rdquo;?
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={submitting}
                              className="bg-danger hover:bg-danger/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {submitting ? "Deleting..." : "Delete"}
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="border border-border text-muted hover:text-foreground text-xs px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // ── Default compact item row ──
                    return (
                      <div
                        key={item.id}
                        className="bg-background border border-border rounded-lg p-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate flex-1">{item.item_name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Target vs Actual + Status badge */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted">
                            <span className="text-foreground font-semibold">{item.actual}</span>
                            <span className="text-muted"> / </span>
                            {item.target}
                          </span>
                          <Badge label={st.label} color={st.badge} />
                        </div>

                        {/* Progress bar */}
                        <ProgressBar value={item.progress} color={st.hex} className="mt-2" />

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-muted mt-2 italic line-clamp-2">
                            &ldquo;{item.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}

        {(summary?.categories ?? []).length === 0 && !loading && (
          <Card className="lg:col-span-2">
            <div className="text-center py-10">
              <Gauge size={36} className="mx-auto text-muted mb-3" />
              <p className="text-muted text-sm mb-1">No KPI data found</p>
              <p className="text-xs text-muted mb-4">
                No presales KPI data for {quarter} {year}
                {selectedPresalesName ? ` (${selectedPresalesName})` : ""}. Add your first KPI to get started.
              </p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                Add KPI
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* 4. Add New KPI Modal — simplified: no Description, no Status, no Unit */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !submitting && setShowAddForm(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-lg p-5 md:p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add New KPI</h2>
                <p className="text-xs text-muted mt-0.5">
                  Create a new presales KPI item for {quarter} {year}
                </p>
              </div>
              <button
                onClick={() => !submitting && setShowAddForm(false)}
                className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-border/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Assign Presales — presales users see only themselves (disabled), superadmin sees all */}
              <div>
                <label className="block text-xs text-muted mb-1.5">
                  Assign Presales {isSuperadmin ? "*" : ""}
                </label>
                {isSuperadmin ? (
                  <select
                    required
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Select presales...
                    </option>
                    {presalesUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={user?.name ?? ""}
                    disabled
                    className={INPUT_CLASS + " opacity-60 cursor-not-allowed"}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={SELECT_CLASS}
                >
                  {categoryOptions.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  placeholder="e.g. Q3 Solution Bundling Proposals"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1.5">Target *</label>
                  <input
                    type="number"
                    required
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    placeholder="e.g. 5"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">Actual</label>
                  <input
                    type="number"
                    value={formData.actual}
                    onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
                    placeholder="0"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Auto-status preview */}
              {formData.target && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Auto Status:</span>
                  <Badge
                    label={getStatusStyle(autoCalculateStatus(Number(formData.actual) || 0, Number(formData.target))).label}
                    color={getStatusStyle(autoCalculateStatus(Number(formData.actual) || 0, Number(formData.target))).badge}
                  />
                  <span className="text-muted">(calculated from actual vs target)</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className={TEXTAREA_CLASS}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-secondary text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {submitting ? "Saving..." : "Create KPI"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  disabled={submitting}
                  className="px-6 py-2.5 border border-border text-muted hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
