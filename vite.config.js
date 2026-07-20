import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import path from "node:path";
import { copyConsultingDemo } from "./scripts/copy-consulting-demo.mjs";

// Fortune is served from the canonical Netlify app through vercel.json.
// Vercel gives a matching static file precedence over a rewrite, so legacy
// copies from public/ must not be present in the deployed Vite output.
const jippiProxyStaticConflicts = [
  "fortune",
  "assets/jippi-payments.js",
  "payment-success.html",
  "payment-fail.html",
  "privacy.html",
  "terms.html",
  "refund.html",
];

function removeJippiProxyStaticConflicts() {
  return {
    name: "remove-jippi-proxy-static-conflicts",
    closeBundle() {
      for (const relativePath of jippiProxyStaticConflicts) {
        rmSync(path.resolve("dist", relativePath), {
          force: true,
          recursive: relativePath === "fortune",
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: "copy-consulting-demo",
      apply: "build",
      buildStart() {
        copyConsultingDemo();
      },
    },
    removeJippiProxyStaticConflicts(),
    react(),
  ],
});
