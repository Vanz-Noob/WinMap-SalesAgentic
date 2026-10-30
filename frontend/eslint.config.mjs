import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // Aturan baru react-hooks v7 (compiler-based) — pola sync dari localStorage
      // saat mount adalah legacy code yang disengaja; dinonaktifkan saat upgrade.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
