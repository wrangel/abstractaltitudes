// tests/csp.test.mjs
//
// The site's CSP exists twice: nginx (authoritative in production) and the
// helmet mirror in server.mjs (pnpm dev). They must agree, and the Cloudflare
// Web Analytics beacon must be allowed — without it the browser blocks the
// script silently and the analytics dashboard simply stays empty.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nginx = readFileSync(new URL("../nginx/conf.d/default.conf", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/backend/server.mjs", import.meta.url), "utf8");

const header = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
const nginxDirective = (name) =>
  header.split(";").map((d) => d.trim().split(/\s+/)).find(([n]) => n === name)?.slice(1) ?? [];
const helmetDirective = (name) =>
  [...(server.match(new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const pairs = {
  "default-src": "defaultSrc",
  "script-src": "scriptSrc",
  "style-src": "styleSrc",
  "img-src": "imgSrc",
  "connect-src": "connectSrc",
  "font-src": "fontSrc",
  "frame-src": "frameSrc",
  "frame-ancestors": "frameAncestors",
  "object-src": "objectSrc",
  "worker-src": "workerSrc",
  "base-uri": "baseUri",
  "form-action": "formAction",
};

test("nginx and helmet CSPs list the same sources", () => {
  for (const [css, camel] of Object.entries(pairs)) {
    assert.deepEqual(helmetDirective(camel).sort(), nginxDirective(css).sort(), css);
  }
});

test("script-src is exactly the site itself plus the Web Analytics beacon", () => {
  // Exact list, not "contains": anything added here — another host, https:,
  // 'unsafe-inline' — must be a deliberate change to this test too.
  assert.deepEqual(nginxDirective("script-src").sort(), ["'self'", "https://static.cloudflareinsights.com"].sort());
});
