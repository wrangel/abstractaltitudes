// scripts/check-ai-crawlers.mjs
//
// Weekly check for crawlers that visit the site without a decision.
//
// Since 2026-11 the AI policy is per crawler (AI Crawl Control → Security,
// mirrored in public/robots.txt). Cloudflare's category-wide "block AI
// training" switch had to go because it blocked Googlebot too, so a *new* AI
// crawler is allowed until someone blocks it by hand. This script is that
// someone's reminder: it asks Cloudflare's analytics which bots visited in the
// last week and reports those not covered by config/ai-crawlers.json.
//
// It never blocks anything itself — Cloudflare's own automatic rule blocked
// Google; a human looks first.
//
// Blind spot: agents that identify themselves by signature rather than user
// agent (ChatGPT agent, Meta's Muse, Manus) look like ordinary Chrome here.
// They are governed in AI Crawl Control directly.
//
//   node --env-file=.env scripts/check-ai-crawlers.mjs
//   node scripts/check-ai-crawlers.mjs --waf   # firewall-rule expression
//
// Needs CLOUDFLARE_RADAR_TOKEN: a Cloudflare API token with Zone → Analytics →
// Read (abstractaltitudes.com) and User → User Details → Read (bot directory).
// Writes the report to $REPORT_FILE when set, and new=true|false to
// $GITHUB_OUTPUT in Actions.

import { readFile, writeFile, appendFile } from "node:fs/promises";
import {
  findUnreviewed,
  renderReport,
  blockListExpression,
  unverifiedBotExpression,
} from "./lib/aiCrawlers.mjs";

const ZONE = "abstractaltitudes.com";
const DAYS = 7;
const API = "https://api.cloudflare.com/client/v4";

// `--waf` prints both firewall-rule expressions for the current decisions and
// exits; no token needed. Re-paste it whenever config/ai-crawlers.json changes.
if (process.argv.includes("--waf")) {
  const decisions = JSON.parse(
    await readFile(new URL("../config/ai-crawlers.json", import.meta.url), "utf8"),
  );
  console.log("# Rule 1 — Block unverified bots\n");
  console.log(unverifiedBotExpression(decisions));
  console.log("\n# Rule 2 — Block AI crawlers not in AI Crawl Control\n");
  console.log(blockListExpression(decisions));
  process.exit(0);
}

const token = process.env.CLOUDFLARE_RADAR_TOKEN;
if (!token) {
  console.error("CLOUDFLARE_RADAR_TOKEN is not set.");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api(path, init) {
  const res = await fetch(`${API}${path}`, { headers, ...init });
  const body = await res.json().catch(() => ({}));
  // Error bodies carry Cloudflare's codes, never the token.
  if (!res.ok || body.success === false || body.errors?.length) {
    throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  }
  return body;
}

async function visitingBots() {
  const zoneTag = (await api(`/zones?name=${ZONE}`)).result[0].id;
  const to = new Date();
  const from = new Date(to - DAYS * 864e5);
  // Everything that is either a verified bot or calls itself one. Ordinary
  // browsers fall through both filters' cracks in findUnreviewed.
  const query = `query($z:String!,$a:Time!,$b:Time!){ viewer { zones(filter:{zoneTag:$z}) {
    httpRequestsAdaptiveGroups(limit: 5000, orderBy: [count_DESC],
      filter: { datetime_geq: $a, datetime_lt: $b }) {
      count dimensions { userAgent verifiedBotCategory } } } } }`;
  const body = await api("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables: { z: zoneTag, a: from.toISOString(), b: to.toISOString() } }),
  });
  return body.data.viewer.zones[0].httpRequestsAdaptiveGroups;
}

async function botDirectory() {
  const bots = [];
  for (let offset = 0; ; offset += 100) {
    const page = (await api(`/radar/bots?limit=100&offset=${offset}&format=JSON`)).result.bots;
    bots.push(...page);
    if (page.length < 100) return bots;
  }
}

const decisions = JSON.parse(
  await readFile(new URL("../config/ai-crawlers.json", import.meta.url), "utf8"),
);
const [rows, directory] = await Promise.all([visitingBots(), botDirectory()]);
const unreviewed = findUnreviewed(rows, decisions, directory);
const date = new Date().toISOString().slice(0, 10);

console.log(`${rows.length} user agents in ${DAYS} days; ${unreviewed.length} bot(s) without a decision.`);
for (const b of unreviewed) console.log(`  NEW  ${b.name}  (${b.operator || "?"}, ${b.category}, ${b.requests} req)`);

if (process.env.REPORT_FILE) await writeFile(process.env.REPORT_FILE, renderReport(unreviewed, date, DAYS));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `new=${unreviewed.length > 0}\n`);
