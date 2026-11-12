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
      // Analytics only fills verifiedBotCategory for bots Cloudflare has
      // verified by origin. Unverified ones are already stopped by the
      // "Block unverified bots" rule, so they need a decision only if they
      // should be let in.
      verified: Boolean(category) || Boolean(prev?.verified),
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

/**
 * Text safe inside a Markdown table cell. User agents are written by whoever
 * sends the request, so a crafted one must not be able to close the cell,
 * the code span or the table: backslashes first, then pipes; backticks and
 * angle brackets are dropped; line breaks become spaces.
 */
export function mdCell(text) {
  return String(text ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[`<>]/g, "");
}

/** Markdown report for the GitHub issue body. */
export function renderReport(unreviewed, date, days) {
  const rows = unreviewed.map(
    (b) =>
      `| **${mdCell(b.name)}** | ${mdCell(b.operator) || "—"} | ${mdCell(b.category)} | ${b.requests} | ${b.verified ? "**allowed** (verified)" : "blocked (unverified)"} | ${suggest(b)} |\n` +
      `| | | <sub>\`${mdCell(b.userAgent.slice(0, 160))}\`</sub> | | | |`,
  );
  return `In the last ${days} days, **${unreviewed.length}** crawler(s) visited abstractaltitudes.com without a decision in \`config/ai-crawlers.json\` (checked ${date}).

| Crawler | Operator | Category | Requests | Right now | Suggestion |
| --- | --- | --- | ---: | --- | --- |
${rows.join("\n")}

**"Right now"** — unverified crawlers are already stopped by the rule *Block unverified bots*; the question for them is only whether one should be **let in** (typically a new search engine). Verified ones get through until decided.

**For each one:**
1. Add its token to \`allow\`, \`block\` or \`ignore\` in \`config/ai-crawlers.json\`. The tests then require \`public/robots.txt\` to match.
2. Run \`node scripts/check-ai-crawlers.mjs --waf\` and paste the two expressions into the Cloudflare rules of the same names (Security → WAF → Custom rules). For a verified bot listed in AI Crawl Control, its switch there works too.
3. This issue closes itself on the next run once nothing is unreviewed.

Rule of thumb: allow search engines and archives; block everything that trains, answers or acts for AI. Never block link-preview fetchers or certificate checks.`;
}

/** Host the firewall rules apply to. Never media.: Bunny pulls images there. */
export const SITE_HOST = "abstractaltitudes.com";

/** Words by which a client declares itself a crawler. */
export const BOT_WORDS = ["bot", "crawl", "spider", "scrap"];

const quote = (t) => `"${t.toLowerCase().replace(/["\\]/g, "")}"`;
const uaContains = (t) => `lower(http.user_agent) contains ${quote(t)}`;

/**
 * Rule "Block AI crawlers not in AI Crawl Control": every `block` token by
 * user agent. Needed for *verified* AI bots, which the unverified-bot rule
 * lets through; duplicates AI Crawl Control harmlessly so one place stays
 * authoritative.
 */
export function blockListExpression(decisions) {
  return Object.keys(decisions.block ?? {})
    .map((t) => `(${uaContains(t)})`)
    .join(" or ");
}

/**
 * Tokens let through the unverified-bot rule: allowed crawlers that Cloudflare
 * does not verify (archives, Bravebot, link previews). The big search engines
 * are left out on purpose — Cloudflare verifies them by origin, and exempting
 * their *names* would let anyone pass as Googlebot.
 */
export function unverifiedExceptions(decisions) {
  const verified = new Set((decisions.verifiedByCloudflare ?? []).map((t) => t.toLowerCase()));
  return Object.keys(decisions.allow ?? {}).filter((t) => !verified.has(t.toLowerCase()));
}

/**
 * Rule "Block unverified bots" (zero trust, as on viaprima.ch): anything that
 * calls itself a bot but is not one Cloudflare has verified by origin
 * (cf.client.bot) is blocked — new crawlers and fake Googlebots alike, with no
 * list to keep current. Scoped to the site host so Bunny's pulls from media.
 * can never be caught; robots.txt stays readable so polite crawlers can learn
 * the policy; /.well-known/ stays open for certificate validation.
 */
export function unverifiedBotExpression(decisions) {
  const words = BOT_WORDS.map(uaContains).join(" or ");
  const exceptions = unverifiedExceptions(decisions).map(uaContains).join(" or ");
  return [
    `(http.host eq "${SITE_HOST}"`,
    ` and not cf.client.bot`,
    ` and (${words})`,
    exceptions ? ` and not (${exceptions})` : "",
    ` and http.request.uri.path ne "/robots.txt"`,
    ` and not starts_with(http.request.uri.path, "/.well-known/"))`,
  ].join("");
}
