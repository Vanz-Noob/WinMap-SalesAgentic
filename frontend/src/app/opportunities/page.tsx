"use client";
import { useEffect, useState } from "react";
import { apiFetch, apiDelete } from "@/lib/api";
import type { Opportunity, Stage } from "@/types";
import { Card, Badge } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

export default function OpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Opportunity[]>("/opportunities"),
      apiFetch<Stage[]>("/stages"),
    ]).then(([o, s]) => {
      setOpps(o);
      setStages(s);
    }).catch((err) => {
      console.error("Failed to fetch opportunities:", err);
    }).finally(() => setLoading(false));
  }, []);

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus opportunity ini?")) return;
    try {
      await apiDelete(`/opportunities/${id}`);
      setOpps((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      alert("Gagal menghapus: " + (err as Error).message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase">
                <th className="text-left py-3 px-3">Nama</th>
                <th className="text-left py-3 px-3">Stage</th>
                <th className="text-right py-3 px-3">Nilai</th>
                <th className="text-center py-3 px-3">Win %</th>
                <th className="text-center py-3 px-3">Presales</th>
                <th className="text-center py-3 px-3">Sumber</th>
                <th className="text-center py-3 px-3">Close Date</th>
                <th className="text-center py-3 px-3">Actions</th>
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
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-border rounded-full h-1.5">
                          <div className="bg-primary rounded-full h-1.5" style={{ width: `${opp.win_probability * 100}%` }} />
                        </div>
                        <span className="text-muted text-xs">{Math.round(opp.win_probability * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {opp.presales_name ? (
                        <span className="text-muted text-xs">🛠 {opp.presales_name}</span>
                      ) : (
                        <span className="text-muted/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {opp.source === "ai_agent" ? <Badge label="AI" color="accent" /> : <Badge label="Manual" color="muted" />}
                    </td>
                    <td className="py-3 px-3 text-center text-muted text-xs">{formatDate(opp.close_date)}</td>
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => handleDelete(opp.id)} className="text-muted hover:text-danger transition-colors">
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
    </div>
  );
}
