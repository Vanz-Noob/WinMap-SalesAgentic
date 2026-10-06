"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  KanbanSquare,
  Target,
  Bot,
  BarChart3,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "winmap_guide_dismissed";
const SHOW_EVENT = "winmap:show-guide";

type Step = {
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
  tips?: string[];
  superadminOnly?: boolean;
};

const steps: Step[] = [
  {
    icon: Sparkles,
    title: "Selamat Datang di WinMap!",
    description:
      "WinMap adalah Sales Intelligence Platform untuk mengelola pipeline, target tracking, dan ranking sales rep Anda. Mari kenali fitur-fitur utamanya.",
    tips: ["Panduan ini hanya muncul sekali", "Anda bisa membuka kembali kapan saja lewat tombol Panduan di sidebar"],
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Lihat ringkasan pipeline, weighted forecast, target tracking, dan ranking sales rep dalam satu layar. Dashboard memberikan overview menyeluruh tentang performa sales tim Anda.",
    tips: ["Pantau Pipeline Status: Healthy, At-Risk, atau Closing Soon", "Lihat Weighted Forecast berdasarkan win probability"],
  },
  {
    icon: KanbanSquare,
    title: "Pipeline (Kanban Board)",
    description:
      "Kelola deal Anda dengan drag & drop kanban board. Pindahkan deal antar stage — dari Prospecting hingga Closed Won — dengan visual yang intuitif.",
    tips: ["Drag card untuk mengubah stage deal", "Klik card untuk melihat detail opportunity"],
  },
  {
    icon: Target,
    title: "Opportunities",
    description:
      "Kelola semua opportunity dan deal dalam satu tempat. Buat opportunity baru, edit detail, atur nilai deal, dan track win probability untuk setiap deal.",
    tips: ["Klik 'New Opportunity' untuk membuat deal baru", "Filter berdasarkan stage, sales rep, atau sumber"],
  },
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "AI agent yang otomatis membuat deal dari berbagai sumber. Konfigurasi agent, monitor aktivitas, dan biarkan AI bekerja untuk Anda.",
    tips: ["Setup agent untuk auto-create deal", "Monitor log aktivitas AI agent"],
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Laporan dan analisis performa sales tim Anda. Lihat tren revenue, conversion rate, dan metrik kunci lainnya untuk pengambilan keputusan.",
    tips: ["Analisis performa per sales rep", "Lihat tren revenue dan conversion rate"],
  },
  {
    icon: ShieldCheck,
    title: "Admin Panel",
    description:
      "Kelola user, role, dan pengaturan sistem. Tambah user baru, atur role (Sales Rep, Presales, Sales Manager, Super Admin), dan konfigurasi sistem.",
    tips: ["Hanya Super Admin yang dapat mengakses", "Kelola user, role, dan pengaturan sistem"],
    superadminOnly: true,
  },
  {
    icon: CheckCircle2,
    title: "Siap Memulai!",
    description:
      "Itulah fitur-fitur utama WinMap. Klik tombol 'Panduan' di sidebar kapan saja untuk melihat panduan ini kembali. Selamat berjualan!",
    tips: ["Mulai dari Dashboard untuk overview", "Buat opportunity pertama Anda di menu Opportunities"],
  },
];

export function UserGuide() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const isSuperadmin = user?.is_superuser || user?.role === "superadmin";

  // Filter steps based on role
  const visibleSteps = steps.filter((s) => !s.superadminOnly || isSuperadmin);

  // Auto-show guide on first visit (when localStorage key doesn't exist)
  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so dashboard loads first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Listen for manual trigger from sidebar button
  const handleShowEvent = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(SHOW_EVENT, handleShowEvent);
    return () => window.removeEventListener(SHOW_EVENT, handleShowEvent);
  }, [handleShowEvent]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  const handleNext = () => {
    if (currentStep < visibleSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const step = visibleSteps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === visibleSteps.length - 1;
  const progress = ((currentStep + 1) / visibleSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm guide-backdrop"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden guide-modal">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-muted hover:text-white hover:bg-border/50 rounded-lg transition-colors z-10"
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-border">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="pt-8 pb-6 px-6">
          {/* Icon + step indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Icon className="text-primary" size={28} />
            </div>
            <span className="text-xs font-medium text-muted bg-border/50 px-3 py-1 rounded-full">
              {currentStep + 1} / {visibleSteps.length}
            </span>
          </div>

          {/* Title + description */}
          <h2 className="text-xl font-bold text-white mb-3">{step.title}</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Tips */}
          {step.tips && step.tips.length > 0 && (
            <ul className="space-y-2 mb-6">
              {step.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted">
                  <span className="text-primary mt-0.5 flex-shrink-0">
                    <HelpCircle size={14} />
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {visibleSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted"
                )}
                aria-label={`Langkah ${i + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Don't show again / Skip */}
            {currentStep === 0 ? (
              <button
                onClick={handleDontShowAgain}
                className="text-xs text-muted hover:text-white transition-colors whitespace-nowrap"
              >
                Jangan tampilkan lagi
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="text-xs text-muted hover:text-white transition-colors whitespace-nowrap"
              >
                Lewati
              </button>
            )}

            {/* Right: Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-white border border-border rounded-lg hover:bg-border/50 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Kembali
                </button>
              )}
              {isLast ? (
                <button
                  onClick={handleDontShowAgain}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition-colors"
                >
                  <CheckCircle2 size={16} />
                  Selesai
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition-colors"
                >
                  Lanjut
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to trigger the guide from anywhere.
 * Usage: window.dispatchEvent(new Event("winmap:show-guide"))
 */
export function showUserGuide() {
  window.dispatchEvent(new Event(SHOW_EVENT));
}
