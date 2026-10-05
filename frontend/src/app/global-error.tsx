"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              Terjadi Kesalahan Sistem
            </h1>
            <p className="text-sm text-muted max-w-md">
              Maaf, terjadi error pada sistem. Silakan coba lagi atau hubungi
              administrator jika masalah berlanjut.
            </p>
          </div>
          <button
            onClick={reset}
            className="bg-primary hover:bg-secondary text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
