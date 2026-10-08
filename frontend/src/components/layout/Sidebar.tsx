"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, Target, Bot, BarChart3, ClipboardCheck, ListChecks, LogOut, X, ShieldCheck, HelpCircle, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Logo } from "@/components/Logo";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  superadminOnly?: boolean;
  presalesOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Ringkasan pipeline, target tracking & ranking sales", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", description: "Kelola deal dengan drag & drop kanban board", icon: KanbanSquare },
  { href: "/opportunities", label: "Opportunities", description: "Daftar semua opportunity dan deal", icon: Target },
  { href: "/agents", label: "AI Agents", description: "Kelola AI agent untuk auto-create deal", icon: Bot },
  { href: "/analytics", label: "Analytics", description: "Laporan dan analisis sales", icon: BarChart3 },
  { href: "/presales-kpi", label: "Presales KPI", description: "Kelola KPI tim presales", icon: ClipboardCheck, presalesOnly: true },
  { href: "/presales-work", label: "Tracking Pekerjaan", description: "Lacak BOM, proposal & POC — sampai close won/lost", icon: ListChecks, presalesOnly: true },
  { href: "/admin", label: "Admin Panel", description: "Manajemen user, role & sistem", icon: ShieldCheck, superadminOnly: true },
];

const roleLabels: Record<string, string> = {
  sales_rep: "Sales Rep",
  presales: "Presales",
  sales_manager: "Sales Manager",
  superadmin: "Super Admin",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";
  const isPresales = user?.role === "presales";
  const visibleItems = navItems.filter(
    (item) =>
      (!item.superadminOnly || isSuperadmin) &&
      (!item.presalesOnly || isSuperadmin || isPresales)
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <Logo variant={theme === "light" ? "light" : "dark"} size={32} />
            <p className="text-xs text-muted mt-1.5 ml-11">Sales Intelligence Platform</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-muted hover:text-foreground hover:bg-border/50 rounded-lg transition-colors"
              title={theme === "light" ? "Ganti ke dark mode" : "Ganti ke light mode"}
              aria-label="Ganti tema terang/gelap"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={onClose}
              className="md:hidden p-2 text-muted hover:text-foreground rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.description}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-border/50 hover:text-foreground",
                  item.superadminOnly && !isActive && "text-accent hover:text-accent"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* Panduan button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => window.dispatchEvent(new Event("winmap:show-guide"))}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-border/50 hover:text-foreground transition-colors"
            title="Tampilkan panduan penggunaan"
          >
            <HelpCircle size={18} />
            Panduan
          </button>
        </div>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
              isSuperadmin ? "bg-accent" : "bg-primary"
            )}>
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted">
                {roleLabels[user?.role ?? ""] ?? user?.role}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-muted hover:text-foreground hover:bg-border/50 rounded-lg transition-colors"
              title="Keluar dari sistem"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
