// tests/rateLimit.test.mjs
//
// Rate limiting behind the Cloudflare Tunnel. The integration tests start a
// real Express app with the production `trust proxy 1` setting and send the
// headers that actually arrive in production, so they prove the bug as well as
// the fix: the "before" test fails the moment someone removes the keyGenerator.

import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import rateLimit from "express-rate-limit";

import { clientKey } from "../src/backend/utils/clientKey.mjs";

// What nginx appends to X-Forwarded-For behind the tunnel: the local hop it
// received the request from. The same for every visitor.
const TUNNEL_HOP = "192.168.160.1";

/** Minimal stand-in for an Express request. */
function fakeReq({ cf, ip = "127.0.0.1" } = {}) {
  return {
    ip,
    get: (name) => (name.toLowerCase() === "cf-connecting-ip" ? cf : undefined),
  };
}

// ---------------------------------------------------------------------------
// clientKey on its own
// ---------------------------------------------------------------------------

test("clientKey uses CF-Connecting-IP when it is a valid address", () => {
  assert.equal(clientKey(fakeReq({ cf: "203.0.113.7", ip: TUNNEL_HOP })), "203.0.113.7");
});

test("clientKey groups IPv6 visitors by /56, so address rotation cannot escape", () => {
  const a = clientKey(fakeReq({ cf: "2001:db8:abcd:1200::1" }));
  const b = clientKey(fakeReq({ cf: "2001:db8:abcd:12ff:ffff::9" }));
  assert.equal(a, b, "two hosts in the same /56 share a budget");
  assert.match(a, /\/56$/);
});

test("clientKey ignores a junk header instead of turning it into a fresh budget", () => {
  for (const junk of ["not-an-ip", "1.2.3.4, 5.6.7.8", "", "   "]) {
    assert.equal(
      clientKey(fakeReq({ cf: junk, ip: TUNNEL_HOP })),
      TUNNEL_HOP,
      `header ${JSON.stringify(junk)} must fall back to req.ip`,
    );
  }
});

test("clientKey falls back to req.ip without Cloudflare in front (dev, pnpm test)", () => {
  assert.equal(clientKey(fakeReq({ ip: "172.18.0.5" })), "172.18.0.5");
});

// ---------------------------------------------------------------------------
// Against a real server, with the production proxy setting
// ---------------------------------------------------------------------------

/**
 * Starts an app with `trust proxy 1` (as in server.mjs) and a limit of 2.
 * Returns a function that sends one request as a given visitor.
 */
async function startApp(t, limiterOptions) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      // The fixture deliberately lets the default keyGenerator use req.ip,
      // which express-rate-limit would otherwise warn about.
      validate: false,
      ...limiterOptions,
    }),
  );
  app.get("/", (_req, res) => res.send("ok"));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => server.close());
  const { port } = server.address();

  return (visitor) =>
    fetch(`http://127.0.0.1:${port}/`, {
      headers: {
        "CF-Connecting-IP": visitor,
        // What reaches Express in production: Cloudflare's entry for the
        // visitor, then nginx's entry for the tunnel hop.
        "X-Forwarded-For": `${visitor}, ${TUNNEL_HOP}`,
      },
    }).then((r) => r.status);
}

test("before the fix: all visitors share one budget behind the tunnel", async (t) => {
  const send = await startApp(t, {}); // default keyGenerator, i.e. req.ip

  assert.equal(await send("203.0.113.1"), 200);
  assert.equal(await send("203.0.113.1"), 200);
  // A completely different person is refused, because req.ip is the tunnel hop
  // for everyone. This is the production bug.
  assert.equal(await send("198.51.100.2"), 429);
});

test("after the fix: each visitor has their own budget", async (t) => {
  const send = await startApp(t, { keyGenerator: clientKey });

  assert.equal(await send("203.0.113.1"), 200);
  assert.equal(await send("203.0.113.1"), 200);
  assert.equal(await send("203.0.113.1"), 429, "the same visitor is still limited");
  assert.equal(await send("198.51.100.2"), 200, "a different visitor is not");
});
