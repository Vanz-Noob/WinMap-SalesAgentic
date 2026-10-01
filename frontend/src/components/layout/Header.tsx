"use client";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/pipeline": "Sales Pipeline",
  "/opportunities": "Opportunities",
  "/agents": "AI Agents",
  "/analytics": "Analytics",
  "/presales-kpi": "Presales KPI",
};

const roleLabels: Record<string, string> = {
  sales_rep: "Sales Rep",
  presales: "Presales",
  sales_manager: "Sales Manager",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "WinMap";
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-background border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-muted w-64 focus:outline-none focus:border-primary"
          />
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white whitespace-nowrap">
              {user.name}
            </span>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
              {roleLabels[user.role] ?? user.role}
            </span>
          </div>
        )}
        <button className="relative p-2 text-muted hover:text-white">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>
      </div>
    </header>
  );
}
