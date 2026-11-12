// tests/robots.test.mjs
//
// public/robots.txt carries the AI-crawler policy. Two mistakes would be
// expensive and silent: blocking a search engine (Search Console only notices
// days later — see the 403s of 2026-11) or losing the training opt-out tokens,
// which exist nowhere but in this file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");

/**
 * Minimal robots.txt reading, enough for this file: consecutive User-agent
 * lines form one group; the rules that follow apply to all of them.
 * Returns Map<lowercased agent, Array<{ type, path }>>.
 */
function groups(src) {
  const map = new Map();
  let agents = [];
  let collectingAgents = false;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const field = key.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "user-agent") {
      if (!collectingAgents) agents = [];
      collectingAgents = true;
      agents.push(value.toLowerCase());
      if (!map.has(value.toLowerCase())) map.set(value.toLowerCase(), []);
    } else if (field === "allow" || field === "disallow") {
      collectingAgents = false;
      for (const a of agents) map.get(a).push({ type: field, path: value });
    } else {
      collectingAgents = false;
    }
  }
  return map;
}

/** Robots rule for an agent: its own group if it has one, else "*". */
function blockedFromRoot(map, agent) {
  const rules = map.get(agent.toLowerCase()) ?? map.get("*") ?? [];
  return rules.some((r) => r.type === "disallow" && r.path === "/");
}

const map = groups(text);

test("search engines, archives and link previews may crawl everything", () => {
  for (const agent of [
    "Googlebot",
    "Bingbot",
    "Applebot",
    "DuckDuckBot",
    "archive.org_bot",
    "facebookexternalhit",
    "Twitterbot",
  ]) {
    assert.equal(blockedFromRoot(map, agent), false, `${agent} must not be blocked`);
  }
});

test("Google and Apple training opt-outs are present", () => {
  // Not crawlers: tokens telling Google/Apple not to train on what their
  // search crawlers fetched. Only robots.txt can express them.
  assert.equal(blockedFromRoot(map, "Google-Extended"), true);
  assert.equal(blockedFromRoot(map, "Applebot-Extended"), true);
});

test("AI training crawlers are disallowed", () => {
  for (const agent of ["GPTBot", "ClaudeBot", "CCBot", "Bytespider", "meta-externalagent", "Google-CloudVertexBot"]) {
    assert.equal(blockedFromRoot(map, agent), true, `${agent} must be disallowed`);
  }
});

test("the sitemap is announced", () => {
  assert.match(text, /^Sitemap: https:\/\/abstractaltitudes\.com\/sitemap\.xml$/m);
});
