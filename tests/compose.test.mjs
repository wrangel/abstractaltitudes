// tests/compose.test.mjs
//
// docker-compose.yml (build, local `pnpm test`) and docker-compose.nas.yml
// (production, host network) must stay in step: same images, and on the NAS
// the addresses nginx and the backend use must fit together and stay local.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const base = read("docker-compose.yml");
const nas = read("docker-compose.nas.yml");
const images = (yml) => [...yml.matchAll(/^\s+image:\s*(\S+)/gm)].map((m) => m[1]).sort();
const env = (yml, key) => yml.match(new RegExp(`-\\s*${key}=(\\S+)`))?.[1];

test("both files run the same images", () => {
  assert.deepEqual(images(nas), images(base));
});

test("on the NAS both services use the host network, without published ports", () => {
  assert.equal((nas.match(/^\s+network_mode:\s*host\s*$/gm) || []).length, 2);
  assert.ok(!/^\s+ports:/m.test(nas), "ports have no meaning with network_mode: host");
  assert.ok(!/^\s+networks:/m.test(nas), "a bridge network would bring the old problem back");
});

test("nginx and the backend agree on the backend's address, and both stay local", () => {
  const port = env(nas, "PORT");
  assert.equal(env(nas, "HOST"), "127.0.0.1");
  assert.equal(env(nas, "BACKEND_UPSTREAM"), `127.0.0.1:${port}`);
  // The Cloudflare tunnel's route points at localhost:3000.
  assert.equal(env(nas, "NGINX_LISTEN"), "127.0.0.1:3000");
});
