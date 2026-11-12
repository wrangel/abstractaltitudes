// scripts/lib/aiCrawlers.mjs
//
// Pure helpers for scripts/check-ai-crawlers.mjs, free of network and file
// access so tests/aiCrawlers.test.mjs can exercise them directly.
//
// Decisions are keyed by user-agent token — the same names public/robots.txt
// uses — because many crawlers that matter (CCBot, Bytespider, PerplexityBot,
// DeepSeekBot, Qwenbot…) are not in Cloudflare's verified-bot directory and
// not in AI Crawl Control's list. Cloudflare's analytics still sees them by
// user agent, and so does this check. The directory is only used to describe a
// bot, never to decide whether it is seen.

/**
 * Categories that have nothing to do with the AI policy — harmless tooling or
 * things governed elsewhere — as Cloudflare's analytics spells them for
 * verified bots.
 */
export const IGNORED_CATEGORIES = new Set([
  "Search Engine Optimization",
  "Security",
  "Monitoring & Analytics",
  "Page Preview",
  "Feed Fetcher",
  "Webhooks",
  "Advertising & Marketing",
  "Accessibility",
  "Social Media Marketing",
  "Aggregator",
  "Commerce",
]);

/** The same categories as the Radar bot directory spells them. */
export const IGNORED_DIRECTORY_CATEGORIES = new Set([
  "SEARCH_ENGINE_OPTIMIZATION",
  "SECURITY",
  "MONITORING_AND_ANALYTICS",
  "PAGE_PREVIEW",
  "FEED_FETCHER",
  "WEBHOOKS",
  "ADVERTISING_AND_MARKETING",
  "ACCESSIBILITY",
  "SOCIAL_MEDIA_MARKETING",
  "AGGREGATOR",
  "COMMERCE",
]);

/** Words that mark a user agent as automated. Browsers never contain them. */
const BOT_WORD = /bot|crawler|crawl|spider|scraper|fetcher|agent|archiver/i;

/**
 * Name a human would recognise the bot by, or null for an ordinary browser.
 *
 * In order of reliability:
 *   "(compatible; FontScanBot/2.0; +https://…)"  → "FontScanBot"
 *   "… compatible; ChatGPT-User/1.0; +https://…" → "ChatGPT-User"
 *   "RecordedFuture Global Inventory Crawler"    → "RecordedFuture"
 *   "NetAPI/1.1 (+https://netapi.com/bot.html)"  → "NetAPI"
 * The first two follow the convention; the last two keep generic words such
 * as "Crawler" or "bot.html" from becoming the name.
 */
export function botToken(userAgent) {
  const ua = (userAgent ?? "").trim();
  if (!BOT_WORD.test(ua)) return null;
  const compatible = ua.match(/compatible;\s*([^;)]+)/i);
  if (compatible) return compatible[1].trim().split(/[\s/]/)[0];
  const named = ua.match(/\b([A-Za-z][A-Za-z0-9._-]{2,}(?:bot|crawler|spider|scraper|fetcher|agent))\b/i);
  if (named) return named[1];
  const product = ua.split(/[\s(]/)[0].split("/")[0];
  return product && product.toLowerCase() !== "mozilla" ? product : null;
}

/** Every token in the decisions file, lower-cased, with its verdict. */
export function decisionTokens(decisions) {
  const tokens = [];
  for (const verdict of ["allow", "block", "ignore"]) {
    for (const token of Object.keys(decisions[verdict] ?? {})) {
      tokens.push({ token: token.toLowerCase(), verdict });
    }
  }
  return tokens;
}

/** The decision covering a user agent, or null. Substring, case-insensitive. */
export function decisionFor(userAgent, tokens) {
  const ua = (userAgent ?? "").toLowerCase();
  return tokens.find((t) => ua.includes(t.token)) ?? null;
}

/** Cloudflare Radar directory entry whose user-agent pattern occurs in `ua`. */
export function directoryEntryFor(userAgent, directory) {
  const ua = (userAgent ?? "").toLowerCase();
  return (
    directory.find((b) =>
      (b.userAgentPatterns ?? []).some((p) => p && ua.includes(p.toLowerCase())),
    ) ?? null
  );
}

/**
 * Bots that visited but have no decision yet, merged per bot.
 *
 * @param {Array<{count:number, dimensions:{userAgent:string, verifiedBotCategory:string}}>} rows
 *   Cloudflare analytics groups for the period.
 * @param {Object} decisions - config/ai-crawlers.json.
 * @param {Array<Object>} directory - Cloudflare Radar bots (for descriptions).
 * @returns {Array<{key, name, operator, category, requests, userAgent}>}
 */
export function findUnreviewed(rows, decisions, directory = []) {
  const tokens = decisionTokens(decisions);
  const merged = new Map();
  for (const { count, dimensions } of rows) {
    const ua = dimensions.userAgent ?? "";
    const category = dimensions.verifiedBotCategory ?? "";
    if (IGNORED_CATEGORIES.has(category)) continue;
    if (decisionFor(ua, tokens)) continue;

    const entry = directoryEntryFor(ua, directory);
    const entryCategories = entry?.categories ?? [];
    if (entryCategories.length && entryCategories.every((c) => IGNORED_DIRECTORY_CATEGORIES.has(c))) continue;

    const token = botToken(ua);
    // A browser-looking user agent with no bot word and no directory match
    // cannot be named — typically an agent that identifies itself by
    // signature (ChatGPT agent, Muse, Manus). Those are governed in AI Crawl
    // Control directly; reporting "some Chrome" would only be noise.
    if (!entry && !token) continue;

    const key = entry?.slug ?? token.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, {
      key,
      name: entry?.name ?? token,
      operator: entry?.operator ?? "",
      category: entryCategories.join(", ") || category || "unverified",
      requests: (prev?.requests ?? 0) + count,
      userAgent: prev?.userAgent ?? ua,
    });
  }
  return [...merged.values()].sort((a, b) => b.requests - a.requests);
}

/** A first suggestion, following the rule used for the reviewed list. */
export function suggest(bot) {
  const c = bot.category.toUpperCase();
  if (/SEARCH.ENGINE.CRAWLER/.test(c) && !/AI.(CRAWLER|ASSISTANT|SEARCH)/.test(c)) {
    return "probably allow — search engine; check reach and whether it trains AI";
  }
  if (/ARCHIV|ACADEMIC/.test(c)) return "your call — archive or research";
  return "probably block — AI, agent or unknown crawler";
}

/** Markdown report for the GitHub issue body. */
export function renderReport(unreviewed, date, days) {
  const rows = unreviewed.map(
    (b) =>
      `| **${b.name}** | ${b.operator || "—"} | ${b.category} | ${b.requests} | ${suggest(b)} |\n` +
      `| | | <sub>\`${b.userAgent.slice(0, 160).replace(/\|/g, "\\|")}\`</sub> | | |`,
  );
  return `In the last ${days} days, **${unreviewed.length}** crawler(s) visited abstractaltitudes.com without a decision in \`config/ai-crawlers.json\` (checked ${date}).

| Crawler | Operator | Category | Requests | Suggestion |
| --- | --- | --- | ---: | --- |
${rows.join("\n")}

**For each one:**
1. To block: add its user-agent token to the Cloudflare custom rule **"Block AI crawlers not in AI Crawl Control"** (Security → WAF → Custom rules) — or, if it appears in AI Crawl Control → Security, switch *Block Crawler* on there instead.
2. If blocked: add the token to the AI group in \`public/robots.txt\` too.
3. Add the token to \`allow\`, \`block\` or \`ignore\` in \`config/ai-crawlers.json\`. This issue closes itself on the next run once nothing is unreviewed.

Rule of thumb: allow search engines and archives; block everything that trains, answers or acts for AI. Never block link-preview fetchers or certificate checks.`;
}

/**
 * Expression for the Cloudflare WAF custom rule that blocks every `block`
 * token by user agent. Covers crawlers missing from AI Crawl Control's list
 * (DeepSeekBot, Qwenbot, …) and duplicates the ones in it, which is harmless
 * and keeps one place authoritative. Paste into Security → WAF → Custom rules
 * → "Block AI crawlers not in AI Crawl Control" → Edit expression.
 */
export function wafExpression(decisions) {
  return Object.keys(decisions.block ?? {})
    .map((t) => `(lower(http.user_agent) contains "${t.toLowerCase().replace(/["\\]/g, "")}")`)
    .join(" or ");
}
