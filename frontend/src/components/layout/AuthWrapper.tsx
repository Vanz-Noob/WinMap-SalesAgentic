"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

const publicPaths = ["/login", "/register"];
const superadminPaths = ["/admin"];

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-muted text-sm">{label}</p>
      </div>
    </div>
  );
}

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPath = publicPaths.includes(pathname);
  const isSuperadminPath = superadminPaths.some((p) => pathname.startsWith(p));
  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicPath) {
      router.replace("/login");
      return;
    }

    if (user && isPublicPath) {
      router.replace("/");
      return;
    }

    // Role-based route protection: non-superadmin trying to access /admin
    if (user && isSuperadminPath && !isSuperadmin) {
      router.replace("/");
      return;
    }
  }, [user, loading, isPublicPath, isSuperadminPath, isSuperadmin, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return <LoadingSpinner label="Memuat..." />;
  }

  if (isPublicPath) {
    if (user) {
      return <LoadingSpinner label="Mengalihkan..." />;
    }
    return <>{children}</>;
  }

  if (!user) {
    return <LoadingSpinner label="Mengalihkan ke login..." />;
  }

  // Block non-superadmin from /admin
  if (isSuperadminPath && !isSuperadmin) {
    return <LoadingSpinner label="Akses ditolak..." />;
  }

  // Authenticated, protected route — full layout with sidebar + header
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
