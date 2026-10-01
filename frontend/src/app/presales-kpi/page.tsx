"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type { PresalesKpiSummary, PresalesKpiItem, User } from "@/types";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
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
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from "recharts";

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

const STATUS_OPTIONS = ["not_started", "in_progress", "achieved", "overdue"];

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
  not_started: { text: "text-muted", bg: "bg-muted", hex: "#64748b", badge: "muted", label: "Not Started" },
};

const INPUT_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-white placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors";
const SELECT_CLASS = INPUT_CLASS;
const TEXTAREA_CLASS =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-white placeholder-muted text-sm focus:outline-none focus:border-primary transition-colors resize-none";

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

function GradientStat({
  label,
  value,
  sublabel,
  icon: Icon,
  gradient,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-5 transition-transform hover:scale-[1.02]", gradient)}>
      <div className="absolute top-4 right-4 opacity-40">
        <Icon size={32} className={iconColor} />
      </div>
      <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold mt-2", valueColor)}>{value}</p>
      {sublabel && <p className="text-xs text-muted/70 mt-1">{sublabel}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PresalesKpiPage() {
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

  const [formData, setFormData] = useState({
    category: "",
    item_name: "",
    description: "",
    target: "",
    actual: "",
    unit: "count",
    status: "not_started",
    notes: "",
  });

  const [editData, setEditData] = useState({
    target: "",
    actual: "",
    status: "not_started",
    notes: "",
  });

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("quarter", quarter);
      params.set("year", String(year));
      if (selectedPresales !== "all") {
        params.set("user_id", selectedPresales);
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
  }, [quarter, year, selectedPresales]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch presales users for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const users = await apiFetch<User[]>("/accounts/users/list");
        setPresalesUsers(users.filter((u) => u.role === "presales"));
      } catch {
        // silently ignore — filter just won't have options
      }
    })();
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const categoryOptions = summary?.categories ?? FALLBACK_CATEGORIES;

  const openAddForm = () => {
    const cats = summary?.categories ?? FALLBACK_CATEGORIES;
    setFormData({
      category: cats[0]?.key ?? "",
      item_name: "",
      description: "",
      target: "",
      actual: "",
      unit: "count",
      status: "not_started",
      notes: "",
    });
    setShowAddForm(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost<PresalesKpiItem>("/presales-kpi", {
        category: formData.category,
        item_name: formData.item_name,
        description: formData.description || null,
        target: Number(formData.target),
        actual: Number(formData.actual),
        unit: formData.unit,
        quarter,
        year,
        status: formData.status,
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
      status: item.status,
      notes: item.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditSubmit = async (id: string) => {
    setSubmitting(true);
    try {
      await apiPatch<PresalesKpiItem>(`/presales-kpi/${id}`, {
        actual: Number(editData.actual),
        target: Number(editData.target),
        status: editData.status,
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
      ? presalesUsers.find((u) => u.id === selectedPresales)?.name
      : undefined;

  const overallScore = summary?.overall_score ?? 0;
  const scoreColor = getScoreColor(overallScore);
  const scoreLabel = getScoreLabel(overallScore);
  const totalItems = summary?.total_items ?? 0;
  const totalAchieved = summary?.total_achieved ?? 0;
  const totalInProgress = summary?.total_in_progress ?? 0;
  const totalOverdue = summary?.total_overdue ?? 0;

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
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Presales KPI Tracking</h1>
          <p className="text-sm text-muted mt-1">
            Track and monitor presales performance across 6 key categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedPresales}
              onChange={(e) => setSelectedPresales(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value="all">All Presales</option>
              {presalesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            >
              {QUARTERS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-card border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            >
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 border border-border text-muted hover:text-white hover:border-primary px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add KPI</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0" />
          <p className="text-danger text-sm flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-danger/70 hover:text-danger"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Overall Score Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overall Score Gauge */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Overall Presales Score"
            subtitle={`${selectedPresalesName ? selectedPresalesName + " • " : ""}${summary?.quarter ?? quarter} ${summary?.year ?? year}`}
            action={<Badge label={scoreLabel} color={overallScore >= 50 ? "success" : "danger"} />}
          />
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-full" style={{ maxWidth: 240 }}>
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart
                  innerRadius="68%"
                  outerRadius="100%"
                  data={[{ name: "score", value: overallScore, fill: scoreColor }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    background={{ fill: "#0f172a" }}
                    dataKey="value"
                    cornerRadius={12}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-white">{overallScore}</span>
                <span className="text-xs text-muted">out of 100</span>
                <span className="text-xs mt-1 font-medium" style={{ color: scoreColor }}>
                  {scoreLabel}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Stat Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <GradientStat
            label="Total Items"
            value={String(totalItems)}
            sublabel={`${summary?.quarter ?? quarter} ${summary?.year ?? year}`}
            icon={Gauge}
            gradient="bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20"
            iconColor="text-primary"
            valueColor="text-primary"
          />
          <GradientStat
            label="Achieved"
            value={String(totalAchieved)}
            sublabel={totalItems > 0 ? `${Math.round((totalAchieved / totalItems) * 100)}% of total` : "0% of total"}
            icon={CheckCircle2}
            gradient="bg-gradient-to-br from-success/15 to-success/5 border-success/20"
            iconColor="text-success"
            valueColor="text-success"
          />
          <GradientStat
            label="In Progress"
            value={String(totalInProgress)}
            sublabel={totalItems > 0 ? `${Math.round((totalInProgress / totalItems) * 100)}% of total` : "0% of total"}
            icon={Loader2}
            gradient="bg-gradient-to-br from-accent/15 to-accent/5 border-accent/20"
            iconColor="text-accent"
            valueColor="text-accent"
          />
          <GradientStat
            label="Overdue"
            value={String(totalOverdue)}
            sublabel={totalItems > 0 ? `${Math.round((totalOverdue / totalItems) * 100)}% of total` : "0% of total"}
            icon={AlertTriangle}
            gradient="bg-gradient-to-br from-danger/15 to-danger/5 border-danger/20"
            iconColor="text-danger"
            valueColor="text-danger"
          />
        </div>
      </div>

      {/* 3. Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(summary?.categories ?? []).map((cat) => {
          const Icon = getCategoryIcon(cat.key, cat.icon);
          const catColor = cat.color || "#3b82f6";
          return (
            <Card key={cat.key} className="hover:shadow-lg hover:shadow-black/20 transition-shadow">
              {/* Category header */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${catColor}22`, color: catColor }}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{cat.label}</h3>
                    <span className="text-xs font-medium" style={{ color: catColor }}>
                      {Math.round(cat.avg_progress)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{cat.description}</p>
                </div>
              </div>

              {/* Category progress bar */}
              <ProgressBar value={cat.avg_progress} color={catColor} className="mb-3" />

              {/* Category stats row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-background border border-border rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">Total</p>
                  <p className="text-base font-bold text-white mt-0.5">{cat.total_items}</p>
                </div>
                <div className="bg-success/5 border border-success/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">Done</p>
                  <p className="text-base font-bold text-success mt-0.5">{cat.achieved_items}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">Progress</p>
                  <p className="text-base font-bold text-primary mt-0.5">{cat.in_progress_items}</p>
                </div>
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">Overdue</p>
                  <p className="text-base font-bold text-danger mt-0.5">{cat.overdue_items}</p>
                </div>
              </div>

              {/* KPI items list */}
              <div className="space-y-3">
                {cat.items.length === 0 && (
                  <div className="text-center py-6 text-muted text-xs">
                    No KPI items in this category yet.
                  </div>
                )}
                {cat.items.map((item) => {
                  const st = getStatusStyle(item.status);

                  // ── Edit mode ──
                  if (editingId === item.id) {
                    return (
                      <div
                        key={item.id}
                        className="bg-background border border-primary/40 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{item.item_name}</p>
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
                        <div>
                          <label className="block text-xs text-muted mb-1">Status</label>
                          <select
                            value={editData.status}
                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                            className={SELECT_CLASS}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {getStatusStyle(s).label}
                              </option>
                            ))}
                          </select>
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
                            className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
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
                        className="bg-danger/5 border border-danger/30 rounded-lg p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle size={16} className="text-danger shrink-0" />
                          <p className="text-xs text-white truncate">
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
                            className="border border-border text-muted hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // ── Default item row ──
                  return (
                    <div
                      key={item.id}
                      className="bg-background border border-border rounded-lg p-3.5 hover:border-primary/40 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{item.item_name}</p>
                          {item.description && (
                            <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                        </div>
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

                      {/* Target vs Actual */}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-xs text-muted">
                          <span className="text-white font-semibold">{item.actual}</span>
                          <span className="text-muted/60"> / </span>
                          {item.target}{" "}
                          <span className="text-muted/70">{item.unit}</span>
                        </span>
                        <Badge label={st.label} color={st.badge} />
                      </div>

                      {/* Progress bar */}
                      <ProgressBar value={item.progress} color={st.hex} className="mt-2" />

                      {/* Notes */}
                      {item.notes && (
                        <p className="text-xs text-muted/70 mt-2 italic line-clamp-2">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {(summary?.categories ?? []).length === 0 && !loading && (
          <Card className="lg:col-span-2">
            <div className="text-center py-12">
              <Gauge size={40} className="mx-auto text-muted mb-3" />
              <p className="text-muted text-sm mb-1">No KPI data found</p>
              <p className="text-xs text-muted/60 mb-4">
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

      {/* 4. Add New KPI Modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !submitting && setShowAddForm(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Add New KPI</h2>
                <p className="text-xs text-muted mt-0.5">
                  Create a new presales KPI item for {quarter} {year}
                </p>
              </div>
              <button
                onClick={() => !submitting && setShowAddForm(false)}
                className="p-1.5 rounded-md text-muted hover:text-white hover:bg-border/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
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

              <div>
                <label className="block text-xs text-muted mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the KPI"
                  className={TEXTAREA_CLASS}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1.5">Target *</label>
                  <input
                    type="number"
                    required
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    placeholder="2"
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
                <div>
                  <label className="block text-xs text-muted mb-1.5">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="count"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={SELECT_CLASS}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {getStatusStyle(s).label}
                    </option>
                  ))}
                </select>
              </div>

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
                  className="px-6 py-2.5 border border-border text-muted hover:text-white rounded-lg transition-colors disabled:opacity-50"
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
