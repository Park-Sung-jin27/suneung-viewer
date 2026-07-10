import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyConsultingDemo } from "./scripts/copy-consulting-demo.mjs";

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
    react(),
  ],
});
