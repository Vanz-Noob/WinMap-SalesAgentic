"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Show the "WinMap" text next to the icon */
  showText?: boolean;
  /** Size of the icon in pixels */
  size?: number;
  /** Additional className */
  className?: string;
  /** Dark background variant — "Win" renders in white instead of navy */
  variant?: "dark" | "light";
}

/**
 * WinMap Logo — mountain/map icon with "WinMap" wordmark.
 * Light variant: "Win" in dark navy (#022258), "Map" in bright blue (#1195fd)
 * Dark variant: "Win" in white, "Map" in bright blue (#1195fd)
 */
export function Logo({
  showText = true,
  size = 36,
  className,
  variant = "light",
}: LogoProps) {
  const winColor = variant === "dark" ? "#ffffff" : "#022258";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Icon: stylized mountain peaks */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Outer rounded square background */}
        <rect width="48" height="48" rx="10" fill="#022258" />
        {/* Larger mountain (left) */}
        <path
          d="M6 36L17 16L23 26L20 30L17 27L13 33L11 31L6 36Z"
          fill="#1195fd"
        />
        {/* Smaller mountain (right) */}
        <path
          d="M26 36L36 19L42 30L39 33L36 28L33 33L30 31L26 36Z"
          fill="#1195fd"
        />
        {/* Valley / path between mountains */}
        <path
          d="M20 30L23 26L26 36L23 33L20 30Z"
          fill="#022258"
          opacity="0.6"
        />
        {/* Sun / circle accent above peaks */}
        <circle cx="36" cy="12" r="3.5" fill="#1195fd" opacity="0.8" />
      </svg>

      {showText && (
        <span className="text-lg font-bold tracking-tight">
          <span style={{ color: winColor }}>Win</span>
          <span style={{ color: "#1195fd" }}>Map</span>
        </span>
      )}
    </div>
  );
}
