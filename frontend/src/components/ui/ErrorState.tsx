"use client";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Gagal Memuat Data",
  message = "Terjadi kesalahan saat memuat data. Silakan coba lagi.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 gap-4">
      <div className="w-14 h-14 rounded-full bg-danger/15 flex items-center justify-center">
        <AlertCircle size={28} className="text-danger" />
      </div>
      <div className="text-center max-w-sm">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-muted mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} />
          Coba Lagi
        </button>
      )}
    </div>
  );
}
