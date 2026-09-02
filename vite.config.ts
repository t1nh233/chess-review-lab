import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function extensionAssets(): Plugin {
  return {
    name: "extension-assets",
    closeBundle() {
      const dist = resolve("dist");
      mkdirSync(resolve(dist, "engine"), { recursive: true });
      copyFileSync(resolve("manifest.json"), resolve(dist, "manifest.json"));
      cpSync(resolve("public/icons"), resolve(dist, "icons"), { recursive: true });
      const engineDir = resolve("node_modules/stockfish/bin");
      for (const file of ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"]) {
        const source = resolve(engineDir, file);
        if (!existsSync(source)) throw new Error(`Missing Stockfish distribution: ${source}`);
        copyFileSync(source, resolve(dist, "engine", file));
      }
      copyFileSync(resolve("engine-package.json"), resolve(dist, "engine/package.json"));
      copyFileSync(resolve("node_modules/stockfish/Copying.txt"), resolve(dist, "engine/COPYING.txt"));
      copyFileSync(resolve("LICENSES_THIRD_PARTY.md"), resolve(dist, "LICENSES_THIRD_PARTY.md"));
      mkdirSync(resolve(dist, "licenses"), { recursive: true });
      const licenses = [
        ["chess.js", "chess.js-BSD-2-Clause.txt"], ["idb", "idb-ISC.txt"],
        ["lucide-react", "lucide-react-ISC.txt"], ["react", "react-MIT.txt"],
        ["react-dom", "react-dom-MIT.txt"], ["scheduler", "scheduler-MIT.txt"],
      ];
      for (const [packageName, target] of licenses) {
        copyFileSync(resolve("node_modules", packageName, "LICENSE"), resolve(dist, "licenses", target));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), extensionAssets()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve("popup.html"),
        review: resolve("review.html"),
        background: resolve("src/background/serviceWorker.ts"),
        content: resolve("src/content/chessComContentScript.ts"),
        engineWorker: resolve("src/engine/stockfishWorker.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background/serviceWorker.js";
          if (chunk.name === "content") return "content/chessComContentScript.js";
          if (chunk.name === "engineWorker") return "engine/stockfishWorker.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});
