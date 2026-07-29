import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Serves the prerendered /places/ pages from build/ during `vite dev`.
 *
 * Those pages are build artifacts, so without this the dev server answers
 * /places/ with the SPA fallback — the footer's "Browse by location" link
 * appears to do nothing but scroll to the top, which is confusing and looks
 * like a bug that does not exist in production.
 *
 * Content is whatever the last `pnpm frontend:build` produced; that is fine
 * for checking links and layout, and the explicit message below beats a
 * silent SPA fallback when nothing has been built yet.
 */
function servePrerenderedPlaces() {
  return {
    name: "serve-prerendered-places",
    apply: "serve",
    configureServer(server) {
      const buildDir = path.resolve(import.meta.dirname, "build");
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url !== "/places" && !url.startsWith("/places/")) return next();

        const file = path.join(buildDir, url.replace(/\/+$/, ""), "index.html");
        // Refuse anything that escaped the build directory via ../ segments.
        if (!file.startsWith(buildDir)) return next();

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          res.end(
            "<h1>Not prerendered yet</h1><p>Run <code>pnpm frontend:build</code> " +
              "to generate the /places/ pages, then reload.</p>",
          );
          return;
        }
        res.end(fs.readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxInclude: ["**/*.jsx", "**/*.js"],
    }),
    servePrerenderedPlaces(),
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
