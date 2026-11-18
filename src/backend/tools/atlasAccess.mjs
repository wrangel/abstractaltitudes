// src/backend/tools/atlasAccess.mjs

// Keeps the Atlas IP access list pointing at the home connection, whose
// public IP is dynamic. DDNS for Atlas, in effect: since 2026-11-18 the
// database admits only the home IP, so an IP change would otherwise take the
// gallery down until someone edited the list by hand.
//
// Only entries whose comment is exactly MANAGED_COMMENT are ever added or
// removed; anything else on the list is left alone. Nothing is removed until
// the new entry is ACTIVE, and the public IP must be confirmed by two
// independent services first — adding a wrong IP and deleting the right one
// would be worse than doing nothing.
//
// No imports: the caller passes in `fetch`, so the whole flow is testable.

export const MANAGED_COMMENT = "Home (NAS + Mac)";
const API = "https://cloud.mongodb.com/api/atlas/v2";
const MEDIA = "application/vnd.atlas.2023-01-01+json";

const IP_SERVICES = [
  "https://api.ipify.org",
  "https://icanhazip.com",
  "https://ifconfig.me/ip",
];
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** The address an access-list entry covers, as a bare IP when it is a /32. */
export function entryIp(entry) {
  if (entry.ipAddress) return entry.ipAddress;
  const [ip, bits] = String(entry.cidrBlock ?? "").split("/");
  return bits === undefined || bits === "32" ? ip : null;
}

/** The value DELETE and status take in the URL: the CIDR block, slash encoded. */
export function entryValue(entry) {
  return encodeURIComponent(entry.cidrBlock ?? `${entry.ipAddress}/32`);
}

/**
 * What to change: add `ip` unless it is already on the list (under any
 * comment), and retire every other entry carrying `comment`.
 */
export function planSync(entries, ip, comment = MANAGED_COMMENT) {
  const managed = entries.filter((entry) => entry.comment === comment);
  return {
    add: !entries.some((entry) => entryIp(entry) === ip),
    remove: managed.filter((entry) => entryIp(entry) !== ip),
  };
}

/**
 * The public IPv4 address, agreed on by at least two services. Throws rather
 * than guess when they disagree or too few answer.
 */
export async function publicIp(fetch, services = IP_SERVICES) {
  const answers = [];
  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const text = (await res.text()).trim();
      if (res.ok && IPV4.test(text)) answers.push(text);
    } catch {
      // one service down is fine; the agreement check below decides
    }
  }
  const counts = new Map();
  for (const ip of answers) counts.set(ip, (counts.get(ip) ?? 0) + 1);
  const [best, votes] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!best || votes < 2) {
    throw new Error(
      `could not confirm the public IP (answers: ${answers.join(", ") || "none"})`,
    );
  }
  return best;
}

async function getToken(fetch, clientId, clientSecret) {
  const res = await fetch("https://cloud.mongodb.com/api/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Atlas token request failed (${res.status}): ${body.error_description ?? body.error ?? "no token"}`,
    );
  }
  return body.access_token;
}

/**
 * One run: confirm the IP, compare with the list, add, wait until ACTIVE,
 * then remove the old managed entries. Returns a one-line summary.
 */
export async function syncAccessList({
  fetch,
  projectId,
  clientId,
  clientSecret,
  comment = MANAGED_COMMENT,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollSeconds = 10,
  maxWaitSeconds = 300,
}) {
  if (!projectId || !clientId || !clientSecret) {
    throw new Error(
      "ATLAS_PROJECT_ID, ATLAS_CLIENT_ID and ATLAS_CLIENT_SECRET must be set",
    );
  }
  const ip = await publicIp(fetch);
  const token = await getToken(fetch, clientId, clientSecret);
  const base = `${API}/groups/${projectId}/accessList`;

  const call = async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers: {
        accept: MEDIA,
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": MEDIA } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `${method} ${url} → ${res.status} ${detail.slice(0, 300)}`,
      );
    }
    return res.status === 204 ? null : res.json();
  };

  const list = await call("GET", `${base}?itemsPerPage=500`);
  const entries = list.results ?? [];
  const { add, remove } = planSync(entries, ip, comment);

  if (!add && remove.length === 0) return `unchanged: ${ip} is on the list`;

  if (add) {
    await call("POST", base, [{ ipAddress: ip, comment }]);
    let status = "PENDING";
    for (let waited = 0; status !== "ACTIVE"; waited += pollSeconds) {
      if (status === "FAILED") throw new Error(`Atlas could not add ${ip}`);
      if (waited >= maxWaitSeconds) {
        throw new Error(
          `${ip} still ${status} after ${maxWaitSeconds}s — old entries kept`,
        );
      }
      await sleep(pollSeconds * 1000);
      const res = await call(
        "GET",
        `${base}/${encodeURIComponent(`${ip}/32`)}/status`,
      );
      status = res?.STATUS ?? res?.status ?? "PENDING";
    }
  }

  for (const entry of remove) {
    await call("DELETE", `${base}/${entryValue(entry)}`);
  }
  const removed = remove.map(entryIp).join(", ");
  return `${add ? `added ${ip}` : `${ip} already listed`}${removed ? `; removed ${removed}` : ""}`;
}
