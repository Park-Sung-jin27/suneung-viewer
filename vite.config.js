import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import path from "node:path";
import { copyConsultingDemo } from "./scripts/copy-consulting-demo.mjs";

// The fortune landing and policy pages are served from the canonical Netlify
// app through vercel.json. Private delivery files are the exception: they are
// tracked gateway assets and must survive the Vite build.
const jippiProxyStaticConflicts = [
  "fortune/fortune-preview.js",
  "fortune/index.html",
  "fortune/privacy.html",
  "fortune/refund.html",
  "fortune/success.html",
  "fortune/terms.html",
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
          recursive: false,
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
