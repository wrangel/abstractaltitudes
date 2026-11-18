// tests/atlasAccess.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MANAGED_COMMENT,
  entryIp,
  entryValue,
  planSync,
  publicIp,
  syncAccessList,
} from "../src/backend/tools/atlasAccess.mjs";

const OLD = "178.38.217.88";
const NEW = "178.38.200.1";
const home = (ip) => ({
  ipAddress: ip,
  cidrBlock: `${ip}/32`,
  comment: MANAGED_COMMENT,
});

test("entry helpers: bare IP for /32, slash encoded for the URL", () => {
  assert.equal(entryIp({ cidrBlock: "1.2.3.4/32" }), "1.2.3.4");
  assert.equal(
    entryIp({ ipAddress: "1.2.3.4", cidrBlock: "1.2.3.4/32" }),
    "1.2.3.4",
  );
  assert.equal(entryIp({ cidrBlock: "10.0.0.0/24" }), null);
  assert.equal(entryValue({ cidrBlock: "1.2.3.4/32" }), "1.2.3.4%2F32");
  assert.equal(entryValue({ ipAddress: "1.2.3.4" }), "1.2.3.4%2F32");
});

test("plan: nothing to do when the IP is listed", () => {
  assert.deepEqual(planSync([home(OLD)], OLD), { add: false, remove: [] });
});

test("plan: new IP is added, the old managed entry retired, others untouched", () => {
  const office = {
    ipAddress: "5.6.7.8",
    cidrBlock: "5.6.7.8/32",
    comment: "Office",
  };
  const anywhere = { cidrBlock: "0.0.0.0/0", comment: "" };
  const plan = planSync([home(OLD), office, anywhere], NEW);
  assert.equal(plan.add, true);
  assert.deepEqual(plan.remove, [home(OLD)]);
});

test("plan: IP already listed under another comment is not added twice", () => {
  const manual = {
    ipAddress: NEW,
    cidrBlock: `${NEW}/32`,
    comment: "added by hand",
  };
  assert.deepEqual(planSync([home(OLD), manual], NEW), {
    add: false,
    remove: [home(OLD)],
  });
});

// A fake fetch: routes by "METHOD url-prefix", records every call.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url, body: init.body, headers: init.headers });
    for (const [key, handler] of Object.entries(routes)) {
      const [m, prefix] = key.split(" ");
      if (m === method && url.startsWith(prefix)) {
        const { status = 200, body = "" } = await handler(url, init);
        // A 204 may not carry a body, not even an empty string.
        return new Response(
          status === 204
            ? null
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
          {
            status,
          },
        );
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  fn.calls = calls;
  return fn;
}

const ipServices = (a, b, c) => ({
  "GET https://api.ipify.org": () => a,
  "GET https://icanhazip.com": () => b,
  "GET https://ifconfig.me": () => c,
});

test("public IP needs two services to agree", async () => {
  const ok = fakeFetch(
    ipServices({ body: NEW }, { body: `${NEW}\n` }, { status: 500 }),
  );
  assert.equal(await publicIp(ok), NEW);

  const split = fakeFetch(
    ipServices({ body: NEW }, { body: OLD }, { body: "<html>" }),
  );
  await assert.rejects(publicIp(split), /could not confirm the public IP/);
});

const TOKEN = {
  "POST https://cloud.mongodb.com/api/oauth/token": () => ({
    body: { access_token: "t0k" },
  }),
};
const BASE = "https://cloud.mongodb.com/api/atlas/v2/groups/p1/accessList";
const creds = { projectId: "p1", clientId: "id", clientSecret: "secret" };

test("sync: unchanged IP makes no changes", async () => {
  const fetch = fakeFetch({
    ...ipServices({ body: OLD }, { body: OLD }, { body: OLD }),
    ...TOKEN,
    [`GET ${BASE}`]: () => ({ body: { results: [home(OLD)] } }),
  });
  assert.match(await syncAccessList({ fetch, ...creds }), /unchanged/);
  assert.ok(
    !fetch.calls.some(
      (c) => ["POST", "DELETE"].includes(c.method) && c.url.startsWith(BASE),
    ),
  );
});

test("sync: IP change adds, waits for ACTIVE, then removes the old entry", async () => {
  let polls = 0;
  const fetch = fakeFetch({
    ...ipServices({ body: NEW }, { body: NEW }, { body: NEW }),
    ...TOKEN,
    [`GET ${BASE}/${encodeURIComponent(`${NEW}/32`)}/status`]: () => ({
      body: { STATUS: ++polls < 2 ? "PENDING" : "ACTIVE" },
    }),
    [`GET ${BASE}`]: () => ({ body: { results: [home(OLD)] } }),
    [`POST ${BASE}`]: () => ({ status: 201, body: { results: [] } }),
    [`DELETE ${BASE}`]: () => ({ status: 204 }),
  });
  const summary = await syncAccessList({
    fetch,
    ...creds,
    sleep: async () => {},
  });
  assert.equal(summary, `added ${NEW}; removed ${OLD}`);

  const writes = fetch.calls.filter(
    (c) => c.url.startsWith(BASE) && c.method !== "GET",
  );
  assert.deepEqual(
    writes.map((c) => c.method),
    ["POST", "DELETE"],
  );
  assert.deepEqual(JSON.parse(writes[0].body), [
    { ipAddress: NEW, comment: MANAGED_COMMENT },
  ]);
  assert.equal(writes[1].url, `${BASE}/${OLD}%2F32`);
  assert.equal(writes[0].headers.authorization, "Bearer t0k");
  assert.equal(
    writes[0].headers["content-type"],
    "application/vnd.atlas.2023-01-01+json",
  );

  const token = fetch.calls.find((c) => c.url.endsWith("/oauth/token"));
  assert.equal(
    token.headers.authorization,
    `Basic ${Buffer.from("id:secret").toString("base64")}`,
  );
  assert.equal(token.body, "grant_type=client_credentials");
});

test("sync: old entry is kept if the new one never becomes ACTIVE", async () => {
  const fetch = fakeFetch({
    ...ipServices({ body: NEW }, { body: NEW }, { body: NEW }),
    ...TOKEN,
    [`GET ${BASE}/`]: () => ({ body: { STATUS: "PENDING" } }),
    [`GET ${BASE}`]: () => ({ body: { results: [home(OLD)] } }),
    [`POST ${BASE}`]: () => ({ status: 201, body: {} }),
    [`DELETE ${BASE}`]: () => ({ status: 204 }),
  });
  await assert.rejects(
    syncAccessList({
      fetch,
      ...creds,
      sleep: async () => {},
      maxWaitSeconds: 30,
    }),
    /still PENDING after 30s — old entries kept/,
  );
  assert.ok(!fetch.calls.some((c) => c.method === "DELETE"));
});

test("sync: unconfirmed IP stops before touching Atlas", async () => {
  const fetch = fakeFetch({
    ...ipServices({ body: NEW }, { status: 503 }, { status: 503 }),
    ...TOKEN,
  });
  await assert.rejects(
    syncAccessList({ fetch, ...creds }),
    /could not confirm/,
  );
  assert.ok(!fetch.calls.some((c) => c.url.includes("cloud.mongodb.com")));
});

test("sync: missing credentials are reported, not guessed", async () => {
  await assert.rejects(
    syncAccessList({ fetch: fakeFetch({}), projectId: "p1" }),
    /ATLAS_PROJECT_ID, ATLAS_CLIENT_ID and ATLAS_CLIENT_SECRET must be set/,
  );
});
