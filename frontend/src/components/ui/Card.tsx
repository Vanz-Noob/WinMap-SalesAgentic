import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sublabel, color = "primary" }: { label: string; value: string; sublabel?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    accent: "text-accent",
  };
  return (
    <Card>
      <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold mt-2", colorMap[color])}>{value}</p>
      {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
    </Card>
  );
}

export function Badge({ label, color = "primary" }: { label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    danger: "bg-danger/20 text-danger",
    accent: "bg-accent/20 text-accent",
    muted: "bg-muted/20 text-muted",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", colorMap[color])}>
      {label}
    </span>
  );
}
