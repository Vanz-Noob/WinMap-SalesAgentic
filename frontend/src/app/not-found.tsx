import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-background">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary mb-2">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-sm text-muted max-w-md">
          Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/"
          className="bg-primary hover:bg-secondary text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Kembali ke Dashboard
        </Link>
        <Link
          href="/opportunities"
          className="border border-border text-muted hover:text-foreground hover:bg-border/30 px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          Lihat Opportunities
        </Link>
      </div>
    </div>
  );
}
