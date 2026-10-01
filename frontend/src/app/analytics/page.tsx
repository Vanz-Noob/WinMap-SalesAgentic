"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AnalyticsData, DashboardSummary } from "@/types";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { formatCurrency, formatCompact, cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  DollarSign, Target, BarChart3, Gauge, ExternalLink, AlertCircle,
  Clock, Activity, TrendingUp, TrendingDown, Trophy, Zap, Users,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ForecastData {
  month: string;
  weighted_pipeline: number;
  unweighted_pipeline: number;
  deal_count: number;
  avg_probability: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#2563eb", "#1d4ed8", "#0d9488", "#059669", "#64748b"];

const TOOLTIP_STYLE = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f8fafc",
  fontSize: "12px",
};

const TOOLTIP_LABEL_STYLE = {
  color: "#64748b",
  marginBottom: "4px",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function GradientStat({
  label, value, sublabel, icon: Icon, gradient, iconColor, valueColor,
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
    <div className={cn("relative overflow-hidden rounded-xl border p-5", gradient)}>
      <div className="absolute top-4 right-4 opacity-40">
        <Icon size={32} className={iconColor} />
      </div>
      <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold mt-2", valueColor)}>{value}</p>
      {sublabel && <p className="text-xs text-muted/70 mt-1">{sublabel}</p>}
    </div>
  );
}

function getHealthColor(score: number): string {
  if (score >= 75) return "#059669";
  if (score >= 50) return "#eab308";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

function getHealthStatus(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 25) return "Needs Attention";
  return "Critical";
}

function getAgingColor(bucket: string): string {
  const b = bucket.toLowerCase();
  if (b.includes("0") && (b.includes("30") || b.includes("7"))) return "#059669";
  if (b.includes("31") || b.includes("60")) return "#eab308";
  if (b.includes("61") || b.includes("90")) return "#f97316";
  return "#ef4444";
}

function formatMonth(m: string): string {
  if (!m) return "N/A";
  try {
    const d = new Date(m);
    if (isNaN(d.getTime())) return m;
    return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
  } catch {
    return m;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [summary, setSummary] = useState<DashboardSummary[]>([]);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableauUrl, setTableauUrl] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<AnalyticsData>("/dashboard/analytics").catch(() => null),
      apiFetch<DashboardSummary[]>("/dashboard/summary").catch(() => []),
      apiFetch<ForecastData[]>("/dashboard/forecast").catch(() => []),
    ]).then(([a, s, f]) => {
      setAnalytics(a);
      setSummary(s);
      setForecast(f);
    }).finally(() => setLoading(false));
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm">Memuat analytics...</p>
      </div>
    );
  }

  // ── Derived Data ─────────────────────────────────────────────────────────

  const winLoss = analytics?.win_loss;
  const dealVelocity = analytics?.deal_velocity;
  const pipelineHealth = analytics?.pipeline_health;
  const sourcePerf = analytics?.source_performance;

  const wonRevenue = winLoss?.won_revenue ?? 0;
  const winRate = winLoss?.win_rate ?? 0;
  const totalWon = winLoss?.total_won ?? 0;
  const totalLost = winLoss?.total_lost ?? 0;
  const avgDealSize = totalWon > 0 ? wonRevenue / totalWon : 0;
  const healthScore = pipelineHealth?.score ?? 0;
  const healthColor = getHealthColor(healthScore);
  const healthStatus = getHealthStatus(healthScore);

  // Revenue trend
  const revenueTrendData = (analytics?.revenue_trend ?? []).map((item) => ({
    month: formatMonth(item.month),
    revenue: item.revenue,
    dealCount: item.deal_count,
  }));

  // Conversion funnel
  const funnelData = (analytics?.conversion_funnel?.stages ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      name: s.name,
      deal_count: s.deal_count,
      total_value: s.total_value,
      conversion_rate: s.conversion_rate,
    }));

  // Deal velocity by stage
  const velocityByStage = (dealVelocity?.by_stage ?? []).map((s) => ({
    stage: s.stage_name,
    avg_days: s.avg_days,
    deal_count: s.deal_count,
  }));

  // Win/loss by month
  const winLossByMonth = (winLoss?.by_month ?? []).map((m) => ({
    month: formatMonth(m.month),
    won: m.won,
    lost: m.lost,
  }));

  // Rep leaderboard
  const repLeaderboard = analytics?.rep_leaderboard ?? [];
  const sortedReps = repLeaderboard.slice().sort((a, b) => b.score - a.score);
  const topPerformer = sortedReps[0];
  const repChartHeight = Math.max(250, sortedReps.length * 36);

  // Deal size distribution
  const dealSizeData = analytics?.deal_size_distribution ?? [];

  // Source performance
  const aiPerf = sourcePerf?.ai;
  const manualPerf = sourcePerf?.manual;

  // Industry breakdown
  const industryData = analytics?.industry_breakdown ?? [];
  const industryPieData = industryData.map((item) => ({
    name: item.industry,
    value: item.total_value,
  }));

  // Aging analysis
  const agingData = analytics?.aging_analysis ?? [];

  // Forecast
  const forecastData = forecast.map((f) => ({
    month: formatMonth(f.month),
    weighted: f.weighted_pipeline,
    unweighted: f.unweighted_pipeline,
    deals: f.deal_count,
  }));

  const totalWeighted = forecastData.reduce((acc, f) => acc + f.weighted, 0);
  const totalUnweighted = forecastData.reduce((acc, f) => acc + f.unweighted, 0);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 1. Top Stats Row — Gradient Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientStat
          label="Total Won Revenue"
          value={formatCurrency(wonRevenue)}
          sublabel={`${totalWon} deals won`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-success/10 to-success/5 border-success/20"
          iconColor="text-success"
          valueColor="text-success"
        />
        <GradientStat
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          sublabel={`${totalWon + totalLost} total deals`}
          icon={Target}
          gradient="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
          iconColor="text-primary"
          valueColor="text-primary"
        />
        <GradientStat
          label="Avg Deal Size"
          value={formatCurrency(avgDealSize)}
          sublabel="Rata-rata per deal won"
          icon={BarChart3}
          gradient="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20"
          iconColor="text-warning"
          valueColor="text-warning"
        />
        <GradientStat
          label="Pipeline Health Score"
          value={`${healthScore}/100`}
          sublabel={healthStatus}
          icon={Gauge}
          gradient="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20"
          iconColor="text-accent"
          valueColor="text-accent"
        />
      </div>

      {/* 2. Pipeline Health Gauge */}
      <Card>
        <CardHeader
          title="🩺 Pipeline Health Score"
          subtitle="Skor kesehatan pipeline dan faktor penentu"
          action={<Badge label={healthStatus} color={healthScore >= 50 ? "success" : "danger"} />}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Radial Gauge */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-full" style={{ maxWidth: 260 }}>
              <ResponsiveContainer width="100%" height={260}>
                <RadialBarChart
                  innerRadius="68%"
                  outerRadius="100%"
                  data={[{ name: "score", value: healthScore, fill: healthColor }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    background={{ fill: "#1e293b" }}
                    dataKey="value"
                    cornerRadius={12}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-white">{healthScore}</span>
                <span className="text-xs text-muted">dari 100</span>
                <span className="text-xs mt-1 font-medium" style={{ color: healthColor }}>
                  {healthStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Factor Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(pipelineHealth?.factors ?? []).map((factor, idx) => {
              const statusConfig =
                factor.status === "good"
                  ? { dot: "bg-success", text: "text-success", bg: "bg-success/5 border-success/20" }
                  : factor.status === "warning"
                  ? { dot: "bg-warning", text: "text-warning", bg: "bg-warning/5 border-warning/20" }
                  : { dot: "bg-danger", text: "text-danger", bg: "bg-danger/5 border-danger/20" };
              return (
                <div key={idx} className={cn("border rounded-lg p-4", statusConfig.bg)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2 h-2 rounded-full", statusConfig.dot)} />
                    <span className="text-xs text-muted uppercase tracking-wider">{factor.label}</span>
                  </div>
                  <p className={cn("text-lg font-bold", statusConfig.text)}>{factor.value}</p>
                  <p className="text-xs text-muted/60 capitalize mt-1">{factor.status}</p>
                </div>
              );
            })}
            {(pipelineHealth?.factors ?? []).length === 0 && (
              <div className="sm:col-span-2 text-center py-8 text-muted text-sm">
                Data faktor pipeline health tidak tersedia
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Revenue Trend + Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend — Area Chart */}
        <Card>
          <CardHeader title="📈 Revenue Trend" subtitle="Tren revenue per bulan" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrendData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Conversion Funnel — Horizontal Bar */}
        <Card>
          <CardHeader
            title="🔻 Conversion Funnel"
            subtitle={`Overall conversion: ${(analytics?.conversion_funnel?.overall_conversion_rate ?? 0).toFixed(1)}%`}
          />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={funnelData} margin={{ left: 10, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => formatCompact(v)} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={110} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number, _name: string, item: { payload?: { conversion_rate?: number; total_value?: number } }) => {
                  const cr = item?.payload?.conversion_rate ?? 0;
                  const tv = item?.payload?.total_value ?? 0;
                  return [`${value} deals (${cr.toFixed(1)}%) | ${formatCompact(tv)}`, "Stage"];
                }}
              />
              <Bar dataKey="deal_count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 4. Deal Velocity + Win/Loss Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deal Velocity */}
        <Card>
          <CardHeader title="⚡ Deal Velocity" subtitle="Waktu rata-rata per tahapan" />
          {/* Mini stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <p className="text-xs text-muted">Avg Days to Close</p>
              </div>
              <p className="text-xl font-bold text-white mt-1">{dealVelocity?.avg_days_to_close ?? 0} hari</p>
            </div>
            <div className="bg-background border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-warning" />
                <p className="text-xs text-muted">Avg Open Deal Age</p>
              </div>
              <p className="text-xl font-bold text-white mt-1">{dealVelocity?.avg_open_deal_age ?? 0} hari</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocityByStage}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="stage" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}h`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number, _name: string, item: { payload?: { deal_count?: number } }) => {
                  const dc = item?.payload?.deal_count ?? 0;
                  return [`${value} hari (${dc} deals)`, "Avg Days"];
                }}
              />
              <Bar dataKey="avg_days" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Win/Loss Analysis */}
        <Card>
          <CardHeader title="🏆 Win/Loss Analysis" subtitle="Performa menang vs kalah per bulan" />
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-success" />
                <p className="text-xs text-muted">Won</p>
              </div>
              <p className="text-xl font-bold text-success mt-1">{totalWon}</p>
            </div>
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3">
              <div className="flex items-center gap-1">
                <TrendingDown size={14} className="text-danger" />
                <p className="text-xs text-muted">Lost</p>
              </div>
              <p className="text-xl font-bold text-danger mt-1">{totalLost}</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-1">
                <Target size={14} className="text-primary" />
                <p className="text-xs text-muted">Win Rate</p>
              </div>
              <p className="text-xl font-bold text-primary mt-1">{winRate.toFixed(1)}%</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winLossByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="won" stackId="a" fill="#059669" name="Won" />
              <Bar dataKey="lost" stackId="a" fill="#ef4444" name="Lost" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 5. Rep Leaderboard */}
      <Card>
        <CardHeader
          title="🥇 Rep Leaderboard"
          subtitle="Peringkat sales representative berdasarkan skor komposit"
          action={topPerformer ? <Badge label={`Top: ${topPerformer.rep_name}`} color="warning" /> : undefined}
        />
        {/* Score bar chart */}
        <ResponsiveContainer width="100%" height={repChartHeight}>
          <BarChart layout="vertical" data={sortedReps} margin={{ left: 10, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 100]} />
            <YAxis type="category" dataKey="rep_name" stroke="#64748b" fontSize={11} width={110} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value: number) => [value.toFixed(1), "Score"]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {sortedReps.map((_rep, idx) => (
                <Cell key={idx} fill={idx === 0 ? "#eab308" : CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Detail table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase">
                <th className="text-left py-3 px-3">Rank</th>
                <th className="text-left py-3 px-3">Name</th>
                <th className="text-center py-3 px-3">Total</th>
                <th className="text-center py-3 px-3">Won</th>
                <th className="text-center py-3 px-3">Lost</th>
                <th className="text-center py-3 px-3">Open</th>
                <th className="text-right py-3 px-3">Won Revenue</th>
                <th className="text-center py-3 px-3">Win Rate</th>
                <th className="text-center py-3 px-3">Quota %</th>
                <th className="text-center py-3 px-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedReps.map((rep, idx) => (
                <tr
                  key={rep.rep_id}
                  className={cn(
                    "border-b border-border/50 hover:bg-border/20 transition-colors",
                    idx === 0 && "bg-warning/5"
                  )}
                >
                  <td className="py-3 px-3">
                    {idx === 0 ? (
                      <span className="flex items-center gap-1 text-warning font-bold">
                        <Trophy size={14} /> 1
                      </span>
                    ) : (
                      <span className="text-muted">{idx + 1}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-white font-medium">
                    {rep.rep_name}
                    {idx === 0 && <span className="ml-2 text-xs text-warning">Top Performer</span>}
                  </td>
                  <td className="py-3 px-3 text-center text-white">{rep.total_deals}</td>
                  <td className="py-3 px-3 text-center text-success">{rep.won_deals}</td>
                  <td className="py-3 px-3 text-center text-danger">{rep.lost_deals}</td>
                  <td className="py-3 px-3 text-center text-primary">{rep.open_deals}</td>
                  <td className="py-3 px-3 text-right text-white">{formatCurrency(rep.won_revenue)}</td>
                  <td className="py-3 px-3 text-center text-white">{rep.win_rate.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-center text-white">{rep.quota_attainment.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-center">
                    <span className={cn("font-bold", idx === 0 ? "text-warning" : "text-white")}>
                      {rep.score.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedReps.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted text-sm">
                    Tidak ada data rep leaderboard
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Deal Size Distribution + Source Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deal Size Distribution */}
        <Card>
          <CardHeader title="📦 Deal Size Distribution" subtitle="Distribusi deal berdasarkan range nilai" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dealSizeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="range" stroke="#64748b" fontSize={10} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number, _name: string, item: { payload?: { total_value?: number } }) => {
                  const tv = item?.payload?.total_value ?? 0;
                  return [`${value} deals | ${formatCompact(tv)}`, "Range"];
                }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Source Performance — AI vs Manual */}
        <Card>
          <CardHeader title="🤖 Source Performance" subtitle="AI Agent vs Manual sourcing" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* AI Agent card */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-primary" />
                <span className="text-sm font-semibold text-white">AI Agent</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Deals</span>
                  <span className="text-white font-medium">{aiPerf?.count ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Won</span>
                  <span className="text-success font-medium">{aiPerf?.won ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Win Rate</span>
                  <span className="text-primary font-medium">{(aiPerf?.win_rate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Avg Value</span>
                  <span className="text-white font-medium">{formatCompact(aiPerf?.avg_value ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Total</span>
                  <span className="text-white font-medium">{formatCompact(aiPerf?.value ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Manual card */}
            <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-muted" />
                <span className="text-sm font-semibold text-white">Manual</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Deals</span>
                  <span className="text-white font-medium">{manualPerf?.count ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Won</span>
                  <span className="text-success font-medium">{manualPerf?.won ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Win Rate</span>
                  <span className="text-white font-medium">{(manualPerf?.win_rate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Avg Value</span>
                  <span className="text-white font-medium">{formatCompact(manualPerf?.avg_value ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Total</span>
                  <span className="text-white font-medium">{formatCompact(manualPerf?.value ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Win rate comparison chart */}
          <p className="text-xs text-muted mb-2">Win Rate Comparison</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={[
              { name: "AI Agent", winRate: aiPerf?.win_rate ?? 0 },
              { name: "Manual", winRate: manualPerf?.win_rate ?? 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Win Rate"]}
              />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                <Cell fill="#3b82f6" />
                <Cell fill="#64748b" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 7. Industry Breakdown + Aging Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Industry Breakdown */}
        <Card>
          <CardHeader title="🏢 Industry Breakdown" subtitle="Distribusi deal per industri" />
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={industryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {industryPieData.map((_entry, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(value: number) => [formatCurrency(value), "Total Value"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Industry table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted uppercase border-b border-border">
                    <th className="text-left py-2 px-2">Industry</th>
                    <th className="text-center py-2 px-2">Deals</th>
                    <th className="text-right py-2 px-2">Value</th>
                    <th className="text-right py-2 px-2">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {industryData.map((item, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 px-2 text-white">{item.industry}</td>
                      <td className="py-2 px-2 text-center text-muted">{item.deal_count}</td>
                      <td className="py-2 px-2 text-right text-muted">{formatCompact(item.total_value)}</td>
                      <td className="py-2 px-2 text-right text-success">{formatCompact(item.won_value)}</td>
                    </tr>
                  ))}
                  {industryData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted">Tidak ada data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Aging Analysis */}
        <Card>
          <CardHeader title="⏰ Aging Analysis" subtitle="Distribusi deal berdasarkan umur" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value: number, _name: string, item: { payload?: { total_value?: number } }) => {
                  const tv = item?.payload?.total_value ?? 0;
                  return [`${value} deals | ${formatCompact(tv)}`, "Bucket"];
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {agingData.map((entry, idx) => (
                  <Cell key={idx} fill={getAgingColor(entry.bucket)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 8. Revenue Forecast */}
      <Card>
        <CardHeader title="🔮 Revenue Forecast" subtitle="Weighted vs unweighted pipeline per bulan" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <p className="text-xs text-muted">Total Weighted Pipeline</p>
            </div>
            <p className="text-xl font-bold text-accent mt-1">{formatCurrency(totalWeighted)}</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              <p className="text-xs text-muted">Total Unweighted Pipeline</p>
            </div>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalUnweighted)}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey="weighted" stroke="#0d9488" strokeWidth={2} name="Weighted" dot={{ r: 4 }} />
            <Line type="monotone" dataKey="unweighted" stroke="#3b82f6" strokeWidth={2} name="Unweighted" dot={{ r: 4 }} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 9. Tableau Embed */}
      <Card>
        <CardHeader
          title="📊 Tableau Dashboard"
          subtitle="Embed Tableau workbook untuk visualisasi advanced"
          action={<Badge label="Tableau Integration" color="accent" />}
        />

        {/* Tableau URL Input */}
        <div className="mb-4">
          <label className="block text-sm text-muted mb-1.5">Tableau Embed URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tableauUrl}
              onChange={(e) => setTableauUrl(e.target.value)}
              placeholder="https://your-tableau-server.com/views/SalesDashboard/Dashboard1"
              className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-white placeholder-muted text-sm focus:outline-none focus:border-primary"
            />
            <a
              href={tableauUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <ExternalLink size={14} />
              Open
            </a>
          </div>
          <p className="text-xs text-muted mt-1.5">
            Masukkan URL Tableau view Anda. Pastikan Tableau Server dapat diakses dan view telah dipublish.
          </p>
        </div>

        {/* Tableau Embed */}
        {tableauUrl ? (
          <div className="rounded-lg overflow-hidden border border-border">
            <iframe
              src={tableauUrl + "?:embed=y&:showAppBanner=false&:display_count=no&:showVizHome=no"}
              width="100%"
              height="600"
              frameBorder="0"
              allowFullScreen
              title="Tableau Dashboard"
            />
          </div>
        ) : (
          <div className="bg-background border border-dashed border-border rounded-lg p-12 text-center">
            <BarChart3 size={48} className="mx-auto text-muted mb-3" />
            <p className="text-muted text-sm mb-1">Belum ada Tableau dashboard</p>
            <p className="text-xs text-muted">
              Masukkan Tableau embed URL di atas untuk menampilkan dashboard
            </p>
            <div className="flex items-center gap-2 justify-center mt-4 text-xs text-muted">
              <AlertCircle size={14} />
              <span>Pastikan view Tableau telah dipublished dengan permission yang sesuai</span>
            </div>
          </div>
        )}
      </Card>

      {/* 10. Stage Detail Table */}
      <Card>
        <CardHeader title="📋 Stage Detail" subtitle="Breakdown per tahapan pipeline" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase">
                <th className="text-left py-3 px-3">Stage</th>
                <th className="text-center py-3 px-3">Deal Count</th>
                <th className="text-right py-3 px-3">Total Value</th>
                <th className="text-center py-3 px-3">Avg Probability</th>
                <th className="text-center py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.stage_name} className="border-b border-border/50 hover:bg-border/20">
                  <td className="py-3 px-3 text-white font-medium">{s.stage_name}</td>
                  <td className="py-3 px-3 text-center text-white">{s.deal_count}</td>
                  <td className="py-3 px-3 text-right text-white">{formatCurrency(s.total_value)}</td>
                  <td className="py-3 px-3 text-center text-muted">{Math.round(s.avg_probability * 100)}%</td>
                  <td className="py-3 px-3 text-center">
                    {s.stage_name === "Closed Won" ? (
                      <Badge label="Won" color="success" />
                    ) : s.stage_name === "Closed Lost" ? (
                      <Badge label="Lost" color="danger" />
                    ) : (
                      <Badge label="Active" color="primary" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
