"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <h2 className="text-xl font-bold text-white">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted text-center max-w-md">
        Maaf, terjadi error saat memuat halaman. Silakan coba lagi.
      </p>
      <pre className="text-xs text-danger bg-card border border-border rounded-lg p-3 max-w-lg overflow-x-auto">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}
