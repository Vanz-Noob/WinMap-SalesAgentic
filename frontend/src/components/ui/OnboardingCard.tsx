"use client";

import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";

interface OnboardingCardProps {
  storageKey: string;
  title: string;
  tips: string[];
}

export function OnboardingCard({ storageKey, title, tips }: OnboardingCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 rounded-xl p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted hover:text-foreground transition-colors"
        title="Tutup tips"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Lightbulb size={16} className="text-primary" />
        </div>
        <div className="flex-1 pr-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-muted flex items-start gap-2">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
