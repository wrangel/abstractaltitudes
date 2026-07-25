import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react({
      jsxInclude: ["**/*.jsx", "**/*.js"],
    }),
    visualizer({
      open: true,
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
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
          return `vendor_${pkgName.replace(/[@/]/g, "_")}`;
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
