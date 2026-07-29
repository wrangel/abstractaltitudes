import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react({
      jsxInclude: ["**/*.jsx", "**/*.js"],
    }),
    // Opt-in only: `ANALYZE=1 pnpm frontend:build`. It used to run on every
    // build and try to open a browser, which breaks in Docker and CI.
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: "stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Take the LAST node_modules segment so pnpm's virtual store
          // (node_modules/.pnpm/pkg@1.0.0/node_modules/pkg/...) resolves to
          // the real package name instead of ".pnpm".
          const segments = id.split("node_modules/");
          const pkgPath = segments[segments.length - 1];
          const [first, second] = pkgPath.split("/");
          const pkgName = first.startsWith("@") ? `${first}/${second}` : first;

          // Group into a few meaningful chunks. Emitting one chunk per
          // package meant dozens of tiny requests; the only splits that
          // actually pay off are the two heavy viewers, which are lazy.
          if (pkgName === "marzipano") return "vendor_marzipano";
          if (pkgName === "openseadragon") return "vendor_openseadragon";
          if (pkgName === "react" || pkgName === "react-dom") {
            return "vendor_react";
          }
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {},
  },
  define: {
    global: "globalThis",
  },
});
