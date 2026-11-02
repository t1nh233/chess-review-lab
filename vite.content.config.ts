import { resolve } from "node:path";
import { defineConfig } from "vite";

// Content scripts run as classic scripts: static `import` is a syntax error there. The main build splits shared code into
// chunks (fine for module pages and the module service worker), so the content script is built separately as one IIFE.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: resolve("src/content/chessComContentScript.ts"),
      formats: ["iife"],
      name: "ChessReviewLabContent",
      fileName: () => "content/chessComContentScript.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
