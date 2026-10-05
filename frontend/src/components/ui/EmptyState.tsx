import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-border/20 flex items-center justify-center mb-4">
        <Icon size={32} className="text-muted/40" />
      </div>
      <h3 className="text-base font-medium text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted mb-5 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
