"use client";
import { useEffect, useState } from "react";
import { apiFetch, apiDelete } from "@/lib/api";
import type { Opportunity, Stage } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { OnboardingCard } from "@/components/ui/OnboardingCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Trash2, Target } from "lucide-react";

export default function OpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Opportunity[]>("/opportunities"),
      apiFetch<Stage[]>("/stages"),
    ]).then(([o, s]) => {
      setOpps(o);
      setStages(s);
    }).catch((err) => {
      console.error("Failed to fetch opportunities:", err);
      toast.error("Gagal memuat data opportunity");
    }).finally(() => setLoading(false));
  }, []);

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/opportunities/${id}`);
      setOpps((prev) => prev.filter((o) => o.id !== id));
      toast.success("Opportunity berhasil dihapus");
    } catch (err) {
      toast.error("Gagal menghapus: " + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
        <Card>
          <TableSkeleton rows={5} cols={8} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingCard
        storageKey="onboarding-opportunities"
        title="Kelola Opportunities Anda"
        tips={[
          "Klik tombol 'New Opportunity' untuk membuat deal baru",
          "Klik nama opportunity untuk melihat detail dan menambah aktivitas",
          "Gunakan ikon tempat sampah untuk menghapus opportunity yang tidak diperlukan",
        ]}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{opps.length} opportunities</p>
        <Link
          href="/opportunities/new"
          className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Opportunity
        </Link>
      </div>

      {opps.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Belum ada opportunity"
            description="Buat opportunity pertama Anda untuk mulai melacak deal dan progress sales pipeline."
            action={
              <Link
                href="/opportunities/new"
                className="inline-flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Buat Opportunity
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase">
                  <th className="text-left py-3 px-3">Nama</th>
                  <th className="text-left py-3 px-3">Stage</th>
                  <th className="text-right py-3 px-3">Nilai</th>
                  <th className="text-center py-3 px-3 hidden md:table-cell">Win %</th>
                  <th className="text-center py-3 px-3 hidden lg:table-cell">Presales</th>
                  <th className="text-center py-3 px-3 hidden md:table-cell">Sumber</th>
                  <th className="text-center py-3 px-3 hidden md:table-cell">Close Date</th>
                  <th className="text-center py-3 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {opps.map((opp) => {
                  const stage = stageMap.get(opp.stage_id || "");
                  return (
                    <tr key={opp.id} className="border-b border-border/50 hover:bg-border/20">
                      <td className="py-3 px-3">
                        <Link href={`/opportunities/${opp.id}`} className="text-white font-medium hover:text-primary">
                          {opp.name}
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <Badge label={stage?.name || "Unknown"} color={stage?.is_won ? "success" : stage?.is_closed ? "danger" : "primary"} />
                      </td>
                      <td className="py-3 px-3 text-right text-white">{formatCurrency(opp.value, opp.currency)}</td>
                      <td className="py-3 px-3 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-border rounded-full h-1.5">
                            <div className="bg-primary rounded-full h-1.5" style={{ width: `${opp.win_probability * 100}%` }} />
                          </div>
                          <span className="text-muted text-xs">{Math.round(opp.win_probability * 100)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center hidden lg:table-cell">
                        {opp.presales_name ? (
                          <span className="text-muted text-xs">🛠 {opp.presales_name}</span>
                        ) : (
                          <span className="text-muted/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center hidden md:table-cell">
                        {opp.source === "ai_agent" ? <Badge label="AI" color="accent" /> : <Badge label="Manual" color="muted" />}
                      </td>
                      <td className="py-3 px-3 text-center text-muted text-xs hidden md:table-cell">{formatDate(opp.close_date)}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setDeleteId(opp.id)}
                          className="text-muted hover:text-danger transition-colors"
                          title="Hapus opportunity"
                          aria-label={`Hapus ${opp.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus Opportunity"
        message="Apakah Anda yakin ingin menghapus opportunity ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        confirmColor="danger"
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
