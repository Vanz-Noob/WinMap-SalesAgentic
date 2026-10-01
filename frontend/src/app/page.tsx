"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  DashboardSummary, Opportunity, SalesOfTheMonth,
  TargetTracking, PipelineInsight,
} from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { formatCurrency, formatCompact, cn } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Briefcase, TrendingUp, Target, Layers, Activity, AlertTriangle, Clock, type LucideIcon } from "lucide-react";

const CHART_COLORS = ["#3b82f6", "#2563eb", "#1d4ed8", "#0d9488", "#059669", "#64748b"];
const TROPHY_ICONS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [sotm, setSotm] = useState<SalesOfTheMonth | null>(null);
  const [targets, setTargets] = useState<TargetTracking | null>(null);
  const [insight, setInsight] = useState<PipelineInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<DashboardSummary[]>("/dashboard/summary"),
      apiFetch<Opportunity[]>("/opportunities?limit=5"),
      apiFetch<SalesOfTheMonth>("/dashboard/sales-of-the-month"),
      apiFetch<TargetTracking>("/dashboard/target-tracking"),
      apiFetch<PipelineInsight>("/dashboard/pipeline-insight"),
    ]).then(([s, o, sm, tt, pi]) => {
      setSummary(s);
      setOpps(o);
      setSotm(sm);
      setTargets(tt);
      setInsight(pi);
    }).catch((err) => {
      console.error("Failed to fetch dashboard data:", err);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;
  }

  const totalPipeline = summary.reduce((acc, s) => acc + s.total_value, 0);
  const totalDeals = summary.reduce((acc, s) => acc + s.deal_count, 0);
  const openStages = summary.filter((s) => s.stage_order <= 4);
  const totalOpenValue = openStages.reduce((acc, s) => acc + s.total_value, 0);
  const weightedForecast = openStages.reduce((acc, s) => acc + s.total_value * s.avg_probability, 0);
  const avgProb = openStages.length > 0
    ? openStages.reduce((acc, s) => acc + s.avg_probability, 0) / openStages.length
    : 0;

  const chartData = summary.map((s) => ({
    name: s.stage_name,
    deals: s.deal_count,
    value: s.total_value,
  }));

  const pieData = summary.filter((s) => s.deal_count > 0).map((s) => ({
    name: s.stage_name,
    value: s.deal_count,
  }));

  return (
    <div className="space-y-6">
      {/* ── Pipeline Health Badge ── */}
      {insight && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-white font-medium">Pipeline Status: Healthy</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{insight.summary.open_deals} open deals</span>
            <span className="flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-400" />
              {insight.summary.at_risk_count} at-risk
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-blue-400" />
              {insight.summary.deals_closing_this_month} closing soon
            </span>
          </span>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientStatCard
          icon={Briefcase}
          label="Total Pipeline"
          value={formatCurrency(totalOpenValue)}
          sublabel={`${totalDeals} deals aktif`}
          gradient="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20"
          iconColor="text-blue-400"
        />
        <GradientStatCard
          icon={TrendingUp}
          label="Weighted Forecast"
          value={formatCurrency(weightedForecast)}
          sublabel="Berdasarkan win probability"
          gradient="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20"
          iconColor="text-teal-400"
        />
        <GradientStatCard
          icon={Target}
          label="Avg Win Probability"
          value={`${Math.round(avgProb * 100)}%`}
          sublabel="Rata-rata seluruh pipeline"
          gradient="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20"
          iconColor="text-amber-400"
        />
        <GradientStatCard
          icon={Layers}
          label="Total Deals"
          value={String(totalDeals)}
          sublabel="Termasuk closed"
          gradient="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
          iconColor="text-emerald-400"
        />
      </div>

      {/* ── Pipeline Insight ── */}
      {insight && (
        <Card>
          <SectionHeader
            title="📊 Pipeline Insight"
            subtitle="High-level overview seluruh pipeline — metrik kunci, stage breakdown & risk analysis"
          />
          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <InsightMetric label="Total Pipeline" value={formatCompact(insight.summary.total_pipeline_value)} color="primary" />
            <InsightMetric label="Weighted" value={formatCompact(insight.summary.weighted_pipeline)} color="accent" />
            <InsightMetric label="Won Revenue" value={formatCompact(insight.summary.total_won_revenue)} color="success" />
            <InsightMetric label="Win Rate" value={`${insight.summary.win_conversion_rate}%`} color="success" />
            <InsightMetric
              label="At-Risk Deals"
              value={String(insight.summary.at_risk_count)}
              color={insight.summary.at_risk_count > 0 ? "danger" : "muted"}
            />
            <InsightMetric
              label="Closing Soon"
              value={String(insight.summary.deals_closing_this_month)}
              color="warning"
            />
          </div>

          {/* Stage breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Table */}
            <div>
              <h4 className="text-xs text-muted uppercase mb-3">Stage Breakdown</h4>
              <div className="space-y-2">
                {insight.stage_insights.map((si) => (
                  <div key={si.stage_id} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    si.is_closed
                      ? si.is_won
                        ? "bg-success/5 border-success/20"
                        : "bg-danger/5 border-danger/20"
                      : "bg-background/50 border-border"
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {si.is_won && <span className="text-xs">✅</span>}
                        {si.is_closed && !si.is_won && <span className="text-xs">❌</span>}
                        <span className="text-sm font-medium text-white">{si.stage_name}</span>
                        {si.at_risk_count > 0 && (
                          <Badge label={`⚠️ ${si.at_risk_count} at-risk`} color="danger" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{si.deal_count} deals</span>
                        <span>·</span>
                        <span>{formatCompact(si.total_value)}</span>
                        <span>·</span>
                        <span>Avg {Math.round(si.avg_probability * 100)}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted">Weighted</p>
                      <p className="text-sm font-semibold text-white">{formatCompact(si.weighted_value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing Soon + At-Risk */}
            <div>
              <h4 className="text-xs text-muted uppercase mb-3">⏰ Closing This Month</h4>
              {insight.closing_soon.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">Tidak ada deal closing bulan ini</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {insight.closing_soon.map((d) => (
                    <Link
                      key={d.id}
                      href={`/opportunities/${d.id}`}
                      className="block p-3 rounded-lg bg-background/50 border border-border hover:border-primary transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate flex-1">{d.name}</p>
                        <span className={cn(
                          "text-xs font-bold shrink-0",
                          d.days_to_close <= 7 ? "text-danger" :
                          d.days_to_close <= 14 ? "text-warning" : "text-muted"
                        )}>
                          {d.days_to_close <= 0 ? "OVERDUE" : `${d.days_to_close}d`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{formatCompact(d.value)}</span>
                        <span>·</span>
                        <span className={d.win_probability < 50 ? "text-danger" : "text-success"}>
                          {d.win_probability}% win
                        </span>
                        <span>·</span>
                        <span>{new Date(d.close_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Target Tracking ── */}
      {targets && (
        <Card>
          <SectionHeader
            title="🎯 Target Tracking"
            subtitle="Perbandingan target company, team & individu — tracking pencapaian revenue vs target"
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Company Target */}
            <TargetBarCard
              title="🏢 Company Target"
              target={targets.company.target}
              achieved={targets.company.achieved}
              pipeline={targets.company.pipeline}
              sublabel={`${targets.company.rep_count} sales reps`}
            />

            {/* Team Targets */}
            <div className="lg:col-span-1 space-y-4">
              <h4 className="text-xs text-muted uppercase">👥 Team Targets</h4>
              {targets.teams.map((team) => (
                <div key={team.team_name} className="bg-background/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{team.team_name}</span>
                    <Badge label={`${team.member_count} reps`} color="muted" />
                  </div>
                  <TargetProgressBar
                    target={team.target}
                    achieved={team.achieved}
                    pipeline={team.pipeline}
                    percentage={team.percentage}
                  />
                </div>
              ))}
            </div>

            {/* Individual Targets */}
            <div className="lg:col-span-1">
              <h4 className="text-xs text-muted uppercase mb-3">👤 Individual Targets</h4>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {targets.individuals
                  .slice()
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((ind) => (
                  <div key={ind.rep_id} className="bg-background/50 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white truncate">{ind.rep_name}</span>
                      <span className={cn(
                        "text-xs font-bold shrink-0 ml-2",
                        ind.percentage >= 100 ? "text-success" :
                        ind.percentage >= 70 ? "text-warning" : "text-danger"
                      )}>
                        {ind.percentage}%
                      </span>
                    </div>
                    <TargetProgressBar
                      target={ind.target}
                      achieved={ind.achieved}
                      pipeline={ind.pipeline}
                      percentage={ind.percentage}
                      compact
                    />
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                      <span>Won: {ind.won_count}</span>
                      <span>·</span>
                      <span>Deals: {ind.deal_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Chart */}
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-xs text-muted uppercase mb-3">📈 Perbandingan Target vs Achievement</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  { name: "Company", Target: targets.company.target, Achieved: targets.company.achieved, Pipeline: targets.company.pipeline },
                  ...targets.teams.map((t) => ({
                    name: t.team_name,
                    Target: t.target,
                    Achieved: t.achieved,
                    Pipeline: t.pipeline,
                  })),
                  ...targets.individuals
                    .slice()
                    .sort((a, b) => b.target - a.target)
                    .slice(0, 6)
                    .map((i) => ({
                      name: i.rep_name.split(" ")[0],
                      Target: i.target,
                      Achieved: i.achieved,
                      Pipeline: i.pipeline,
                    })),
                ]}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <defs>
                  <linearGradient id="achievedGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="pipelineGradientH" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => formatCompact(v)} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={70} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  labelStyle={{ color: "#f8fafc", fontWeight: 600 }}
                  itemStyle={{ color: "#cbd5e1" }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Target" fill="#64748b" radius={[0, 2, 2, 0]} />
                <Bar dataKey="Achieved" fill="url(#achievedGradient)" radius={[0, 2, 2, 0]} />
                <Bar dataKey="Pipeline" fill="url(#pipelineGradientH)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart - Funnel */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Sales Funnel" subtitle="Jumlah deal per stage" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#f8fafc", fontWeight: 600 }}
                itemStyle={{ color: "#93c5fd" }}
                cursor={{ fill: "#3b82f620" }}
                formatter={(value: number) => [`${value} deals`, "Jumlah Deal"]}
              />
              <Bar dataKey="deals" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart - Distribution */}
        <Card>
          <SectionHeader title="Distribusi Deal" subtitle="Per stage" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                <radialGradient id="pieGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6} />
                </radialGradient>
              </defs>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={40}
                paddingAngle={2}
                label
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0f172a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                labelStyle={{ color: "#f8fafc", fontWeight: 600 }}
                itemStyle={{ color: "#cbd5e1" }}
                formatter={(value: number, name: string) => [`${value} deals`, name as string]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#64748b" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Sales of the Month ── */}
      {sotm && sotm.ranking.length > 0 && (
        <Card>
          <SectionHeader
            title="🏆 Sales of the Month"
            subtitle={`Ranking bulan ${sotm.month} — berdasarkan win rate, won revenue & aktivitas`}
          />
          {/* Winner Highlight */}
          {sotm.winner && (
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🥇</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-white">{sotm.winner.rep_name}</h4>
                    <Badge label={`Score: ${sotm.winner.composite_score}`} color="warning" />
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted">
                    <span>✅ Won: <strong className="text-white">{sotm.winner.won_deals}</strong> deals</span>
                    <span>💰 Revenue: <strong className="text-white">{formatCompact(sotm.winner.won_revenue)}</strong></span>
                    <span>📊 Win Rate: <strong className="text-white">{sotm.winner.win_rate}%</strong></span>
                    <span>🎯 Quota: <strong className="text-white">{sotm.winner.quota_attainment}%</strong></span>
                    <span>🔄 Open: <strong className="text-white">{sotm.winner.open_deals}</strong> deals</span>
                    <span>📞 Activities: <strong className="text-white">{sotm.winner.activity_count}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Ranking Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase">
                  <th className="text-center py-2 px-2">Rank</th>
                  <th className="text-left py-2 px-2">Sales Rep</th>
                  <th className="text-center py-2 px-2">Won</th>
                  <th className="text-center py-2 px-2">Lost</th>
                  <th className="text-center py-2 px-2">Open</th>
                  <th className="text-right py-2 px-2">Won Revenue</th>
                  <th className="text-center py-2 px-2">Win Rate</th>
                  <th className="text-center py-2 px-2">Quota %</th>
                  <th className="text-center py-2 px-2">Activities</th>
                  <th className="text-center py-2 px-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {sotm.ranking.map((rep) => (
                  <tr key={rep.rep_id} className={`border-b border-border/50 hover:bg-border/20 ${rep.rank === 1 ? "bg-amber-500/5" : ""}`}>
                    <td className="py-2.5 px-2 text-center text-lg">{TROPHY_ICONS[rep.rank - 1] || rep.rank}</td>
                    <td className="py-2.5 px-2 text-white font-medium">{rep.rep_name}</td>
                    <td className="py-2.5 px-2 text-center text-success font-semibold">{rep.won_deals}</td>
                    <td className="py-2.5 px-2 text-center text-danger">{rep.lost_deals}</td>
                    <td className="py-2.5 px-2 text-center text-muted">{rep.open_deals}</td>
                    <td className="py-2.5 px-2 text-right text-white">{formatCompact(rep.won_revenue)}</td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 bg-border rounded-full h-1.5">
                          <div className={`${rep.win_rate >= 60 ? "bg-success" : rep.win_rate >= 30 ? "bg-warning" : "bg-danger"} rounded-full h-1.5`} style={{ width: `${Math.min(rep.win_rate, 100)}%` }} />
                        </div>
                        <span className="text-muted text-xs">{rep.win_rate}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-muted text-xs">{rep.quota_attainment}%</td>
                    <td className="py-2.5 px-2 text-center text-muted">{rep.activity_count}</td>
                    <td className="py-2.5 px-2 text-center">
                      <Badge label={String(rep.composite_score)} color={rep.rank === 1 ? "warning" : "muted"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Recent Opportunities ── */}
      <Card>
        <SectionHeader title="Opportunities Terbaru" subtitle="5 deal terakhir" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase">
                <th className="text-left py-3 px-2">Nama Opportunity</th>
                <th className="text-right py-3 px-2">Nilai</th>
                <th className="text-center py-3 px-2">Win Prob</th>
                <th className="text-center py-3 px-2">Sumber</th>
                <th className="text-center py-3 px-2">Close Date</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((opp) => (
                <tr key={opp.id} className="border-b border-border/50 hover:bg-border/20">
                  <td className="py-3 px-2 text-white font-medium">{opp.name}</td>
                  <td className="py-3 px-2 text-right text-white">{formatCurrency(opp.value, opp.currency)}</td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-border rounded-full h-1.5">
                        <div className="bg-primary rounded-full h-1.5" style={{ width: `${opp.win_probability * 100}%` }} />
                      </div>
                      <span className="text-muted text-xs">{Math.round(opp.win_probability * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {opp.source === "ai_agent" ? <Badge label="AI Agent" color="accent" /> : <Badge label="Manual" color="muted" />}
                  </td>
                  <td className="py-3 px-2 text-center text-muted text-xs">
                    {opp.close_date ? new Date(opp.close_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "-"}
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

/* ── Helper Components ── */

function GradientStatCard({ icon: Icon, label, value, sublabel, gradient, iconColor }: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  gradient: string;
  iconColor: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", gradient)}>
      <div className="absolute top-0 right-0 opacity-10">
        <Icon size={64} className={iconColor} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} className={iconColor} />
          <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
      </div>
    </Card>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-accent" />
      <div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function InsightMetric({ label, value, color = "primary" }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: "from-blue-500/10 to-transparent border-blue-500/20 text-blue-400",
    success: "from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400",
    warning: "from-amber-500/10 to-transparent border-amber-500/20 text-amber-400",
    danger: "from-red-500/10 to-transparent border-red-500/20 text-red-400",
    accent: "from-teal-500/10 to-transparent border-teal-500/20 text-teal-400",
    muted: "from-slate-500/10 to-transparent border-slate-500/20 text-slate-400",
  };
  return (
    <div className={cn("bg-gradient-to-br border rounded-lg p-3 text-center", colorMap[color])}>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold mt-1 text-white">{value}</p>
    </div>
  );
}

function TargetBarCard({ title, target, achieved, pipeline, sublabel }: {
  title: string;
  target: number;
  achieved: number;
  pipeline: number;
  sublabel?: string;
}) {
  const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
  return (
    <div>
      <h4 className="text-xs text-muted uppercase mb-3">{title}</h4>
      <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">{sublabel}</span>
          <span className={cn(
            "text-2xl font-bold",
            percentage >= 100 ? "text-success" : percentage >= 70 ? "text-warning" : "text-danger"
          )}>
            {percentage}%
          </span>
        </div>
        <TargetProgressBar target={target} achieved={achieved} pipeline={pipeline} percentage={percentage} />
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div>
            <p className="text-xs text-muted">Target</p>
            <p className="text-sm font-bold text-white">{formatCompact(target)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Achieved</p>
            <p className="text-sm font-bold text-success">{formatCompact(achieved)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Pipeline</p>
            <p className="text-sm font-bold text-primary">{formatCompact(pipeline)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TargetProgressBar({ target, achieved, pipeline, percentage, compact }: {
  target: number;
  achieved: number;
  pipeline: number;
  percentage: number;
  compact?: boolean;
}) {
  const barHeight = compact ? "h-1.5" : "h-2.5";
  const pipelinePct = target > 0 ? Math.min((pipeline / target) * 100, 100) : 0;
  return (
    <div className={cn("w-full bg-border rounded-full overflow-hidden relative", barHeight)}>
      {/* Pipeline indicator (lighter shade) */}
      <div className="absolute h-full bg-primary/20 rounded-full" style={{ width: `${pipelinePct}%` }} />
      {/* Achieved portion */}
      <div
        className={cn("h-full rounded-full transition-all relative",
          percentage >= 100 ? "bg-success" : percentage >= 70 ? "bg-warning" : "bg-danger")}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}
