// tests/aiCrawlers.test.mjs
//
// The crawler policy exists in three places — config/ai-crawlers.json,
// public/robots.txt and the Cloudflare firewall rule generated from the
// config. These tests keep them in step, and above all make sure no block
// token can ever catch a search engine: Cloudflare's own category rule did
// exactly that to Googlebot in 2026-11.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  botToken,
  decisionFor,
  decisionTokens,
  findUnreviewed,
  wafExpression,
} from "../scripts/lib/aiCrawlers.mjs";

const decisions = JSON.parse(
  readFileSync(new URL("../config/ai-crawlers.json", import.meta.url), "utf8"),
);
const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");

// Real user agents of crawlers that must never be blocked.
const MUST_PASS = {
  "Googlebot Smartphone":
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Googlebot Desktop": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Googlebot Images": "Googlebot-Image/1.0",
  Bingbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
  Applebot:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  DuckDuckBot: "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  "Internet Archive": "Mozilla/5.0 (compatible; archive.org_bot +http://archive.org/details/archive.org_bot)",
  "Facebook link preview": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  Twitterbot: "Twitterbot/1.0",
  Bravebot: "Mozilla/5.0 (compatible; Bravebot/1.0; +https://search.brave.com/help/brave-search-crawler)",
};

const blockTokens = Object.keys(decisions.block).map((t) => t.toLowerCase());

test("no block token matches a search engine, archive or link preview", () => {
  for (const [who, ua] of Object.entries(MUST_PASS)) {
    const hit = blockTokens.find((t) => ua.toLowerCase().includes(t));
    assert.equal(hit, undefined, `${who} would be blocked by "${hit}"`);
  }
});

test("each must-pass crawler is covered by an allow or ignore decision", () => {
  const tokens = decisionTokens(decisions);
  for (const [who, ua] of Object.entries(MUST_PASS)) {
    const d = decisionFor(ua, tokens);
    assert.ok(d && d.verdict !== "block", `${who} has no allow/ignore decision`);
  }
});

test("no token is listed under two verdicts", () => {
  const seen = new Map();
  for (const { token, verdict } of decisionTokens(decisions)) {
    assert.ok(!seen.has(token), `"${token}" is both ${seen.get(token)} and ${verdict}`);
    seen.set(token, verdict);
  }
});

test("every blockable token is disallowed in robots.txt", () => {
  const disallowed = new Set();
  let agents = [];
  let inAgents = false;
  for (const raw of robots.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|disallow|allow):\s*(.*)$/i);
    if (!m) continue;
    if (m[1].toLowerCase() === "user-agent") {
      if (!inAgents) agents = [];
      inAgents = true;
      agents.push(m[2].toLowerCase());
    } else {
      inAgents = false;
      if (m[1].toLowerCase() === "disallow" && m[2] === "/") agents.forEach((a) => disallowed.add(a));
    }
  }
  // robots.txt tokens cannot contain spaces ("Anchor Browser" is firewall-only).
  for (const t of blockTokens.filter((t) => !t.includes(" "))) {
    assert.ok(disallowed.has(t), `robots.txt does not disallow "${t}"`);
  }
  for (const t of Object.keys(decisions.allow)) {
    assert.ok(!disallowed.has(t.toLowerCase()), `robots.txt disallows allowed "${t}"`);
  }
});

test("the firewall expression covers every block token and fits Cloudflare's limit", () => {
  const expr = wafExpression(decisions);
  assert.ok(expr.length < 4096, `expression is ${expr.length} characters`);
  for (const t of blockTokens) assert.ok(expr.includes(`contains "${t}"`), `missing ${t}`);
});

test("botToken names bots the way a person would, and ignores browsers", () => {
  const cases = {
    "Mozilla/5.0 (compatible; FontScanBot/2.0; +https://fontscan.net/fontscanbot)": "FontScanBot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot": "ChatGPT-User",
    "RecordedFuture Global Inventory Crawler": "RecordedFuture",
    "NetAPI/1.1 (+https://netapi.com/bot.html)": "NetAPI",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15": null,
  };
  for (const [ua, name] of Object.entries(cases)) assert.equal(botToken(ua), name, ua);
});

test("findUnreviewed reports only undecided bots, merged, skipping tooling and browsers", () => {
  const row = (count, userAgent, verifiedBotCategory = "") => ({ count, dimensions: { userAgent, verifiedBotCategory } });
  const rows = [
    row(100, MUST_PASS["Googlebot Smartphone"], "Search Engine Crawler"), // allowed
    row(20, "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"), // blocked
    row(30, "Mozilla/5.0 (compatible; AhrefsBot/7.0)", "Search Engine Optimization"), // tooling
    row(50, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0 Safari/537.36"), // browser
    row(7, "Mozilla/5.0 (compatible; NewAIBot/1.0; +https://example.ai/bot)"),
    row(3, "Mozilla/5.0 (compatible; NewAIBot/1.1; +https://example.ai/bot)"),
    row(4, "Mozilla/5.0 (compatible; PromoBot/1.0)"),
  ];
  const directory = [{ slug: "promo", name: "PromoBot", operator: "Ads Inc", categories: ["ADVERTISING_AND_MARKETING"], userAgentPatterns: ["PromoBot"] }];
  const out = findUnreviewed(rows, decisions, directory);
  assert.deepEqual(out.map((b) => [b.name, b.requests]), [["NewAIBot", 10]]);
});
