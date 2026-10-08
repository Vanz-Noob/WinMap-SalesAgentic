import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { AuthWrapper } from "@/components/layout/AuthWrapper";
import { ThemeToaster } from "@/components/ThemeToaster";

// Inter — variable font, self-hosted agar build tidak butuh akses Google Fonts
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  display: "swap",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata: Metadata = {
  title: "WinMap — Sales Intelligence Platform",
  description: "AI-powered sales pipeline management dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: pasang tema tersimpan sebelum render */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <AuthWrapper>{children}</AuthWrapper>
            <ThemeToaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
