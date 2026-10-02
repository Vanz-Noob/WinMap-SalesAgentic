"use client";
import { useState, useEffect } from "react";
import { apiPost, apiFetch } from "@/lib/api";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { Bot, Workflow, BarChart3, Play, Loader2, Download, FileSpreadsheet, Sparkles, Info, ChevronUp } from "lucide-react";
import type { User } from "@/types";

export default function AgentsPage() {
  const [opportunityInput, setOpportunityInput] = useState("");
  const [opportunityResult, setOpportunityResult] = useState<Record<string, unknown> | null>(null);
  const [pipelineResult, setPipelineResult] = useState<unknown[] | Record<string, unknown> | null>(null);
  const [briefingResult, setBriefingResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Export Agent state
  const [exportDataType, setExportDataType] = useState<"pipeline" | "presales">("pipeline");
  const [exportStageFilter, setExportStageFilter] = useState("all");
  const [exportOwner, setExportOwner] = useState("all");
  const [exportCategory, setExportCategory] = useState("all");
  const [exportQuarter, setExportQuarter] = useState("Q3");
  const [exportYear, setExportYear] = useState(2026);
  const [exportResult, setExportResult] = useState<Record<string, unknown> | null>(null);
  const [salesReps, setSalesReps] = useState<User[]>([]);

  // Onboarding toggle
  const [showGuide, setShowGuide] = useState(true);

  // Fetch sales reps for export filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const users = await apiFetch<User[]>("/accounts/users/list");
        setSalesReps(users.filter((u) => u.role === "sales_rep" || u.role === "sales_manager"));
      } catch {
        // silently ignore — dropdown just won't have options
      }
    })();
  }, []);

  const runOpportunityAgent = async () => {
    if (!opportunityInput.trim()) return;
    setLoading("opportunity");
    setOpportunityResult(null);
    try {
      const result = await apiPost<Record<string, unknown>>("/agents/opportunity/run", { raw_input: opportunityInput });
      setOpportunityResult(result);
    } catch (err) {
      setOpportunityResult({ error: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const runPipelineScan = async () => {
    setLoading("pipeline");
    setPipelineResult(null);
    try {
      const result = await apiPost<unknown[] | Record<string, unknown>>("/agents/pipeline/scan?limit=5", {});
      setPipelineResult(result);
    } catch (err) {
      setPipelineResult({ error: (err as Error).message + " — Pipeline Agent memproses banyak deal, mungkin butuh waktu. Coba lagi." });
    } finally {
      setLoading(null);
    }
  };

  const getBriefing = async () => {
    setLoading("briefing");
    setBriefingResult(null);
    try {
      const result = await apiFetch<Record<string, unknown>>("/agents/insight/briefing");
      setBriefingResult(result);
    } catch (err) {
      setBriefingResult({ error: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const runExportAgent = async () => {
    setLoading("export");
    setExportResult(null);
    try {
      const body: Record<string, unknown> = {
        data_type: exportDataType,
        quarter: exportDataType === "presales" ? exportQuarter : undefined,
        year: exportDataType === "presales" ? exportYear : undefined,
      };
      if (exportDataType === "pipeline") {
        body.stage_filter = exportStageFilter;
        body.owner_id = exportOwner !== "all" ? exportOwner : undefined;
      } else {
        body.category = exportCategory;
      }
      const result = await apiPost<Record<string, unknown>>("/agents/export/run", body);
      setExportResult(result);
    } catch (err) {
      setExportResult({ error: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const downloadCsv = () => {
    if (!exportResult?.csv_content) return;
    const csv = exportResult.csv_content as string;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dataType = exportResult.data_type as string;
    const ts = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `export_${dataType}_${ts}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const agentCards = [
    {
      id: "opportunity",
      title: "Opportunity Agent",
      tagline: "Ubah catatan jadi deal",
      icon: Bot,
      bgClass: "bg-primary/20",
      textClass: "text-primary",
      shortDesc: "Tempel teks dari email/chat/meeting, AI akan ekstrak info deal & kasih skor BANT otomatis.",
      steps: "1. Salin teks → 2. Tempel di kotak → 3. Klik Run → 4. Deal otomatis dibuat jika skor > 50%",
    },
    {
      id: "pipeline",
      title: "Pipeline Agent",
      tagline: "Cek kesehatan deal",
      icon: Workflow,
      bgClass: "bg-accent/20",
      textClass: "text-accent",
      shortDesc: "AI scan semua deal aktif, kasih win probability & next action yang harus dilakukan.",
      steps: "1. Klik Scan → 2. Tunggu proses → 3. Lihat evaluasi per deal → 4. Ikuti rekomendasi AI",
    },
    {
      id: "briefing",
      title: "Insight Agent",
      tagline: "Briefing harian sales",
      icon: BarChart3,
      bgClass: "bg-warning/20",
      textClass: "text-warning",
      shortDesc: "Rangkuman harian: total pipeline, deal yang perlu perhatian, & forecast singkat.",
      steps: "1. Klik Get Briefing → 2. Baca rangkuman → 3. Cek alert & rekomendasi",
    },
    {
      id: "export",
      title: "Export Agent",
      tagline: "Export data + AI insight",
      icon: Download,
      bgClass: "bg-success/20",
      textClass: "text-success",
      shortDesc: "Download data pipeline/presales ke CSV lengkap dengan analisa & rekomendasi AI.",
      steps: "1. Pilih tipe data → 2. Set filter → 3. Klik Export → 4. Download CSV atau baca AI summary",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Onboarding Guide */}
      {showGuide && (
        <Card>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Info size={16} className="text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-white">Panduan AI Agents</h2>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-muted hover:text-white transition-colors lg:hidden"
              aria-label="Tutup panduan"
            >
              <ChevronUp size={18} />
            </button>
          </div>
          <div className="space-y-2.5 text-sm text-muted leading-relaxed">
            <p>
              <span className="text-white font-medium">AI Agents</span> adalah asisten cerdas yang bantu kerjaan sales kamu.
              Setiap agent punya fungsi berbeda — dari ekstrak deal baru, evaluasi pipeline, briefing harian, sampai export data.
            </p>
            <p>
              <span className="text-white font-medium">Cara pake:</span> Scroll ke bawah, pilih agent yang mau dipake, ikuti instruksinya.
              Beberapa agent juga <span className="text-white">jalan otomatis</span> di background (pipeline scan tiap jam, briefing tiap hari).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <div className="bg-background/60 border border-border rounded-lg p-3">
                <p className="text-xs text-white font-medium mb-1">⚡ Quick Start</p>
                <p className="text-xs text-muted">Mulai dari <span className="text-primary">Opportunity Agent</span> — tempel catatan meeting, lihat AI bikin deal otomatis.</p>
              </div>
              <div className="bg-background/60 border border-border rounded-lg p-3">
                <p className="text-xs text-white font-medium mb-1">💡 Tips</p>
                <p className="text-xs text-muted">Pipeline & Insight Agent bisa dipake kapan aja untuk cek kondisi sales kamu saat ini.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Agent Cards - compact overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {agentCards.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.id}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${agent.bgClass}`}>
                  <Icon size={20} className={agent.textClass} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{agent.title}</h3>
                    <Badge color="muted" label={agent.tagline} />
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{agent.shortDesc}</p>
                  <p className="text-[11px] text-muted/70 mt-2 leading-relaxed">{agent.steps}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Opportunity Agent Trigger */}
      <Card>
        <CardHeader title="Opportunity Agent" subtitle="Tempel teks (email, chat, catatan meeting) untuk ekstrak deal otomatis" />
        <div className="space-y-3">
          <textarea
            value={opportunityInput}
            onChange={(e) => setOpportunityInput(e.target.value)}
            rows={4}
            placeholder="Contoh: PT Maju Jaya kontak kita, butuh sistem CRM. Budget 500 juta, keputusan 2 bulan. Contact: Budi, CTO."
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-primary resize-none"
          />
          <button
            onClick={runOpportunityAgent}
            disabled={!opportunityInput.trim() || loading === "opportunity"}
            className="flex items-center gap-2 bg-primary hover:bg-secondary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading === "opportunity" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Run Opportunity Agent
          </button>
        </div>
        {opportunityResult && (
          <div className="mt-4 bg-background border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase mb-2">Result</p>
            <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(opportunityResult, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Pipeline & Insight Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Pipeline Agent" subtitle="Scan 5 deal aktif untuk evaluasi & next action" />
          <button
            onClick={runPipelineScan}
            disabled={loading === "pipeline"}
            className="flex items-center gap-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading === "pipeline" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading === "pipeline" ? "Memproses..." : "Scan Pipeline (5 Deals)"}
          </button>
          {pipelineResult && (
            <div className="mt-4 bg-background border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-muted uppercase mb-2">Result ({Array.isArray(pipelineResult) ? pipelineResult.length : 0} deals evaluated)</p>
              <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(pipelineResult, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Insight Agent" subtitle="Briefing harian: pipeline, alert & rekomendasi" />
          <button
            onClick={getBriefing}
            disabled={loading === "briefing"}
            className="flex items-center gap-2 bg-warning hover:bg-warning/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading === "briefing" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Get Daily Briefing
          </button>
          {briefingResult && (
            <div className="mt-4 bg-background border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-muted uppercase mb-2">Briefing</p>
              <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(briefingResult, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </div>

      {/* Export Agent */}
      <Card>
        <CardHeader
          title="Export Agent"
          subtitle="Export pipeline/presales data ke CSV + AI summary & rekomendasi"
        />

        {/* Data Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setExportDataType("pipeline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              exportDataType === "pipeline"
                ? "bg-success text-white"
                : "bg-background border border-border text-muted hover:text-white"
            }`}
          >
            <Workflow size={16} />
            Pipeline / Sales
          </button>
          <button
            onClick={() => setExportDataType("presales")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              exportDataType === "presales"
                ? "bg-success text-white"
                : "bg-background border border-border text-muted hover:text-white"
            }`}
          >
            <FileSpreadsheet size={16} />
            Presales KPI
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {exportDataType === "pipeline" ? (
            <>
              <div>
                <label className="text-xs text-muted mb-1 block">Stage Filter</label>
                <select
                  value={exportStageFilter}
                  onChange={(e) => setExportStageFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="all">All Stages</option>
                  <option value="open">Open Deals Only</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                  <option value="Prospecting">Prospecting</option>
                  <option value="Qualification">Qualification</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Negotiation">Negotiation</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Sales Rep</label>
                <select
                  value={exportOwner}
                  onChange={(e) => setExportOwner(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="all">All Reps</option>
                  {salesReps.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted mb-1 block">Category</label>
                <select
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="bundling_solution">Bundling Solution</option>
                  <option value="marketing_activities">Marketing Activities</option>
                  <option value="certification">Certification</option>
                  <option value="relationship_principal">Relationship with Principal</option>
                  <option value="upselling_cross_selling">Upselling & Cross-selling</option>
                  <option value="response_time">Response Time</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Quarter</label>
                <select
                  value={exportQuarter}
                  onChange={(e) => setExportQuarter(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Year</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runExportAgent}
            disabled={loading === "export"}
            className="flex items-center gap-2 bg-success hover:bg-success/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading === "export" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {loading === "export" ? "Exporting..." : "Export Data"}
          </button>
          {!!exportResult?.csv_content && (
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <FileSpreadsheet size={16} />
              Download CSV
            </button>
          )}
        </div>

        {/* Export Results */}
        {exportResult && (
          <div className="mt-4 space-y-4">
            {/* Error */}
            {!!exportResult.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400">{exportResult.error as string}</p>
              </div>
            )}

            {/* Summary Stats */}
            {!exportResult.error && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted">Records Exported</p>
                    <p className="text-xl font-bold text-white">{exportResult.record_count as number}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted">Data Type</p>
                    <p className="text-sm font-semibold text-success capitalize">{exportResult.data_type as string}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted">Columns</p>
                    <p className="text-sm font-semibold text-white">{(exportResult.columns as string[])?.length || 0}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted">Exported At</p>
                    <p className="text-sm font-semibold text-white">
                      {new Date(exportResult.exported_at as string).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* AI Summary */}
                {!!exportResult.ai_summary && (
                  <div className="bg-gradient-to-br from-success/10 to-primary/10 border border-success/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-success" />
                      <p className="text-sm font-semibold text-white">AI Export Summary</p>
                    </div>
                    <p className="text-sm text-white mb-3">
                      {(exportResult.ai_summary as Record<string, unknown>).summary as string}
                    </p>
                    {!!(exportResult.ai_summary as Record<string, unknown>).key_metrics && (
                      <div className="mb-3">
                        <p className="text-xs text-muted uppercase mb-1">Key Metrics</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(
                            (exportResult.ai_summary as Record<string, unknown>).key_metrics as Record<string, string>
                          ).map(([k, v]) => (
                            <Badge key={k} color="primary" label={`${k}: ${v}`} />
                          ))}
                        </div>
                      </div>
                    )}
                    {!!(exportResult.ai_summary as Record<string, unknown>).recommendations && (
                      <div>
                        <p className="text-xs text-muted uppercase mb-1">Recommendations</p>
                        <ul className="text-sm text-white space-y-1">
                          {((exportResult.ai_summary as Record<string, unknown>).recommendations as string[]).map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-success mt-0.5">•</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Data Preview */}
                <div className="bg-background border border-border rounded-lg p-4 max-h-96 overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted uppercase">Data Preview</p>
                    <Badge color="success" label={`${exportResult.record_count as number} rows`} />
                  </div>
                  <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(exportResult.data, null, 2).slice(0, 3000)}
                    {JSON.stringify(exportResult.data).length > 3000 && "\n\n... (truncated, download CSV for full data)"}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
