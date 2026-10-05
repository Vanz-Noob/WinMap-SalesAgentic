"use client";

import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "danger" | "primary";
  icon?: LucideIcon;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  confirmColor = "primary",
  icon: Icon = AlertTriangle,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              confirmColor === "danger" ? "bg-danger/15" : "bg-primary/15"
            )}
          >
            <Icon
              size={20}
              className={confirmColor === "danger" ? "text-danger" : "text-primary"}
            />
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="text-sm text-muted mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-muted hover:text-white hover:bg-border/30 rounded-lg text-sm transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors",
              confirmColor === "danger"
                ? "bg-danger hover:bg-danger/80"
                : "bg-primary hover:bg-secondary"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
