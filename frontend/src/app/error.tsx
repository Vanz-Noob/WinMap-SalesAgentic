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
      <h2 className="text-xl font-bold text-foreground">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted text-center max-w-md">
        Maaf, terjadi error saat memuat halaman. Silakan coba lagi.
      </p>
      {error.digest && (
        <p className="text-xs text-muted/60">
          Kode referensi: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}
