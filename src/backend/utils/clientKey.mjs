// src/backend/utils/clientKey.mjs
//
// The key every rate limiter in this server counts requests under.
//
// Why not plain req.ip: since 2026-10-30 the site is served through a
// Cloudflare Tunnel. A request reaches Express as
//
//   visitor -> Cloudflare -> cloudflared (NAS host) -> nginx -> Express
//
// and nginx appends the address it received the request from — the tunnel's
// local hop, identical for every visitor — to X-Forwarded-For. With
// `trust proxy 1`, Express takes exactly that last entry, so req.ip was the same
// for everyone and all visitors shared one budget: twenty clicks a minute for
// the whole world, not per person.
//
// Cloudflare states the real visitor address in CF-Connecting-IP, which it sets
// itself and overwrites if a client sends one. That is trustworthy only for
// traffic that actually came through Cloudflare. While the router still
// forwards 80/443 to the NAS, a client can skip Cloudflare and send a forged
// header to dodge the limit; that gap closes when those ports are closed.
//
// No Node built-ins besides `net`, and no Express import: a pure function of
// the request, so it can be tested without a server.

import { isIP } from "node:net";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * @param {import("express").Request} req
 * @returns {string} Rate-limit key: the visitor's IP (an IPv6 /56 subnet, as
 *   express-rate-limit recommends, so one host cannot rotate through its
 *   addresses to escape the limit).
 */
export function clientKey(req) {
  const header = req.get?.("cf-connecting-ip")?.trim();

  // Only a syntactically valid address is used. Anything else falls back to
  // req.ip rather than becoming a key of its own — otherwise a client could
  // mint unlimited fresh budgets by sending a different junk string each time.
  if (header && isIP(header)) return ipKeyGenerator(header);

  // No Cloudflare in front: local dev, `pnpm test`, or the direct path while
  // the router ports are still open.
  return ipKeyGenerator(req.ip ?? "");
}
