"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, Target, Bot, BarChart3, ClipboardCheck, LogOut, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  superadminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/presales-kpi", label: "Presales KPI", icon: ClipboardCheck },
  { href: "/admin", label: "Admin Panel", icon: ShieldCheck, superadminOnly: true },
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

  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";
  const visibleItems = navItems.filter(
    (item) => !item.superadminOnly || isSuperadmin
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
            <Logo variant="dark" size={32} />
            <p className="text-xs text-muted mt-1.5 ml-11">Sales Intelligence Platform</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 text-muted hover:text-white rounded-lg"
          >
            <X size={20} />
          </button>
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-border/50 hover:text-white",
                  item.superadminOnly && !isActive && "text-accent hover:text-accent"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
              isSuperadmin ? "bg-accent" : "bg-primary"
            )}>
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted">
                {roleLabels[user?.role ?? ""] ?? user?.role}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-muted hover:text-white hover:bg-border/50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
