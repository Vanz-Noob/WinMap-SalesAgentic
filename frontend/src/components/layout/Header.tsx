"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Menu } from "lucide-react";
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

const searchablePages = [
  { href: "/", label: "Dashboard", desc: "Overview & metrics" },
  { href: "/pipeline", label: "Pipeline", desc: "Sales pipeline kanban" },
  { href: "/opportunities", label: "Opportunities", desc: "Manage opportunities" },
  { href: "/agents", label: "AI Agents", desc: "AI-powered sales assistants" },
  { href: "/analytics", label: "Analytics", desc: "Performance analytics" },
  { href: "/presales-kpi", label: "Presales KPI", desc: "Track presales KPIs" },
];

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || "WinMap";
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPages = searchQuery
    ? searchablePages.filter(
        (p) =>
          p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchablePages;

  const notifications = [
    { id: 1, title: "New opportunity assigned", desc: "PT Maju Jaya — $50K", time: "5m ago" },
    { id: 2, title: "KPI target achieved", desc: "Monthly demo target reached", time: "1h ago" },
    { id: 3, title: "AI Agent insight ready", desc: "Pipeline analysis complete", time: "3h ago" },
  ];

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-muted hover:text-white rounded-lg flex-shrink-0"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-white truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="bg-background border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-muted w-28 sm:w-48 md:w-64 focus:outline-none focus:border-primary"
          />
          {searchFocused && searchQuery && (
            <div className="absolute top-full mt-2 left-0 w-full min-w-[260px] bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              {filteredPages.length > 0 ? (
                filteredPages.map((page) => (
                  <button
                    key={page.href}
                    onClick={() => {
                      router.push(page.href);
                      setSearchQuery("");
                      setSearchFocused(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-border/50 transition-colors flex flex-col"
                  >
                    <span className="text-sm font-medium text-white">{page.label}</span>
                    <span className="text-xs text-muted">{page.desc}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted">No results found</div>
              )}
            </div>
          )}
        </div>

        {/* User info — hidden on small screens */}
        {user && (
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm font-medium text-white whitespace-nowrap">
              {user.name}
            </span>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
              {roleLabels[user.role] ?? user.role}
            </span>
          </div>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-muted hover:text-white rounded-lg transition-colors"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
          </button>
          {notifOpen && (
            <div className="absolute top-full mt-2 right-0 w-72 sm:w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Notifications</span>
                <span className="text-xs text-muted">{notifications.length} new</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b border-border/50 hover:bg-border/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <p className="text-xs text-muted mt-0.5">{n.desc}</p>
                        <p className="text-xs text-muted/80 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full px-4 py-2.5 text-sm text-primary hover:bg-border/50 transition-colors">
                Mark all as read
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
