"use client";
import { useEffect, useState } from "react";
import { apiFetch, apiPatch } from "@/lib/api";
import type { Stage, Opportunity, User } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { KanbanSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { OnboardingCard } from "@/components/ui/OnboardingCard";
import { formatCompact, cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch stages + opportunities first (these always work for any logged-in user)
    Promise.all([
      apiFetch<Stage[]>("/stages"),
      apiFetch<Opportunity[]>("/opportunities"),
    ]).then(([s, o]) => {
      setStages(s.sort((a, b) => a.order - b.order));
      setOpps(o);
    }).catch((err) => {
      console.error("Failed to fetch pipeline data:", err);
      setError("Gagal memuat data pipeline. Silakan refresh halaman.");
    }).finally(() => setLoading(false));

    // Fetch users list separately — only superadmin can access this endpoint.
    // For non-superadmin, the filter dropdown simply won't show (user sees their own data only).
    apiFetch<User[]>("/accounts/users/list")
      .then((u) => setUsers(u))
      .catch(() => {
        // 403 is expected for non-superadmin — silently ignore, filter dropdown stays hidden
      });
  }, []);

  const handleDrop = async (stageId: string) => {
    if (!draggedId) return;
    const opp = opps.find((o) => o.id === draggedId);
    if (!opp || opp.stage_id === stageId) return;

    // Optimistic update
    setOpps((prev) => prev.map((o) => (o.id === draggedId ? { ...o, stage_id: stageId } : o)));
    setDraggedId(null);

    try {
      await apiPatch(`/opportunities/${draggedId}`, { stage_id: stageId });
      toast.success(`Deal dipindahkan ke "${stages.find((s) => s.id === stageId)?.name || stageId}"`);
    } catch (err) {
      console.error("Failed to move:", err);
      toast.error("Gagal memindahkan deal, mengembalikan ke posisi semula");
      // Revert on error
      setOpps((prev) => prev.map((o) => (o.id === draggedId ? { ...o, stage_id: opp.stage_id } : o)));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Skeleton className="h-4 w-72" />
        </div>
        <KanbanSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-danger text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // Filter opportunities by selected sales rep
  const filteredOpps = selectedRep === "all"
    ? opps
    : opps.filter((o) => o.owner_id === selectedRep);

  return (
    <div className="space-y-4">
      <OnboardingCard
        storageKey="onboarding-pipeline"
        title="Cara menggunakan Pipeline"
        tips={[
          "Drag & drop card opportunity antar kolom stage untuk mengubah status deal",
          "Klik card untuk melihat dan mengedit detail opportunity",
          "Gunakan filter di kanan untuk melihat deal per sales rep tertentu",
        ]}
      />
      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-muted">
          Drag &amp; drop opportunity antar stage. Klik card untuk edit detail. Perubahan otomatis tersimpan.
        </p>
        <div className="flex items-center gap-3">
          {users.length > 0 && (
            <>
              <label className="text-xs text-muted uppercase tracking-wider">Filter Sales Rep:</label>
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary cursor-pointer min-w-[180px]"
              >
                <option value="all">📊 Semua Sales Rep</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Pipeline Kanban — Semua 6 Stage */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageOpps = filteredOpps.filter((o) => o.stage_id === stage.id);
          const totalValue = stageOpps.reduce((acc, o) => acc + o.value, 0);
          const isClosedStage = stage.is_closed;
          return (
            <div
              key={stage.id}
              className="w-72 shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              {/* Stage Header */}
              <div className={cn(
                "border rounded-t-xl px-4 py-3",
                isClosedStage
                  ? stage.is_won
                    ? "bg-success/10 border-success/30"
                    : "bg-danger/10 border-danger/30"
                  : "bg-card border-border"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {stage.is_won && <span>✅</span>}
                    {stage.is_closed && !stage.is_won && <span>❌</span>}
                    <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
                  </div>
                  <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">
                    {stageOpps.length}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">{formatCompact(totalValue)}</p>
              </div>
              {/* Stage Body */}
              <div className={cn(
                "border border-t-0 rounded-b-xl p-3 min-h-[200px] space-y-2",
                isClosedStage
                  ? stage.is_won
                    ? "bg-success/5 border-success/30"
                    : "bg-danger/5 border-danger/30"
                  : "bg-background/50 border-border"
              )}>
                {stageOpps.map((opp) => {
                  const owner = users.find((u) => u.id === opp.owner_id);
                  return (
                    <Link
                      key={opp.id}
                      href={`/opportunities/${opp.id}`}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", opp.id); setDraggedId(opp.id); }}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={(e) => { if (draggedId) e.preventDefault(); }}
                      className={cn(
                        "block bg-card border border-border rounded-lg p-3 cursor-grab hover:border-primary transition-colors",
                        draggedId === opp.id && "opacity-50"
                      )}
                    >
                      <p className="text-sm font-medium text-white mb-1 line-clamp-2 hover:text-primary">{opp.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted">{formatCompact(opp.value)}</span>
                        <Badge label={`${Math.round(opp.win_probability * 100)}%`} color={opp.win_probability >= 0.7 ? "success" : opp.win_probability >= 0.4 ? "warning" : "danger"} />
                      </div>
                      {opp.close_date && (
                        <p className="text-xs text-muted mt-1.5">
                          Close: {new Date(opp.close_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                      {opp.presales_name && (
                        <p className="text-xs text-muted/60 mt-1 truncate">
                          🛠 {opp.presales_name}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {opp.source === "ai_agent" ? (
                          <Badge label="AI" color="accent" />
                        ) : (
                          <span className="text-xs text-muted/50">manual</span>
                        )}
                        {owner && (
                          <span className="text-xs text-muted/70 truncate max-w-[100px]">
                            👤 {owner.name.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {stageOpps.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted border-2 border-dashed border-border rounded-lg">
                    {isClosedStage ? "—" : selectedRep !== "all" ? "Tidak ada deal" : "Drop deal di sini"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
