import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        card: "#1e293b",
        border: "#334155",
        primary: "#3b82f6",
        secondary: "#2563eb",
        accent: "#0d9488",
        success: "#059669",
        warning: "#f59e0b",
        danger: "#ef4444",
        muted: "#94a3b8",
      },
    },
  },
  plugins: [],
};
export default config;
