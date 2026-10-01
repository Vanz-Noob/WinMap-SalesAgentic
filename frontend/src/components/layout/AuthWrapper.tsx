"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

const publicPaths = ["/login", "/register"];

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

  const isPublicPath = publicPaths.includes(pathname);

  useEffect(() => {
    if (loading) return;

    // Not authenticated and trying to access a protected route -> redirect to login
    if (!user && !isPublicPath) {
      router.replace("/login");
      return;
    }

    // Authenticated and on a public route (login/register) -> redirect to dashboard
    if (user && isPublicPath) {
      router.replace("/");
      return;
    }
  }, [user, loading, isPublicPath, router]);

  // Show loading spinner while auth state is being determined
  if (loading) {
    return <LoadingSpinner label="Memuat..." />;
  }

  // Public pages (login/register) render without sidebar/header
  if (isPublicPath) {
    // If user is already authenticated, show spinner while redirect fires
    if (user) {
      return <LoadingSpinner label="Mengalihkan..." />;
    }
    return <>{children}</>;
  }

  // Protected route but not authenticated — show spinner while redirect fires
  if (!user) {
    return <LoadingSpinner label="Mengalihkan ke login..." />;
  }

  // Authenticated, protected route — full layout with sidebar + header
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
