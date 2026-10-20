import assert from "node:assert/strict";
import { generateKeyPairSync, verify, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { API_VERSION, Client, LemakError } from "../dist/index.js";

const here = new URL(".", import.meta.url).pathname;
const v = JSON.parse(readFileSync(join(here, "../testdata/vectors.json"), "utf8"));

// serve answers with the scripted replies in order, then 200 {}, and records every request.
async function serve(t, ...replies) {
  const seen = [];
  const srv = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      const r = replies.shift() ?? [200, "{}"];
      if (r === "drop") return req.socket.destroy();
      if (r === "hang") return;
      res.writeHead(r[0], { "Content-Type": "application/json", ...(r[2] ?? {}) });
      res.end(r[1]);
    });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  t.after(() => srv.close());
  srv.closeAllConnections && t.after(() => srv.closeAllConnections());
  const client = (o = {}) => new Client({ apiKey: "sk_test_X", baseURL: `http://127.0.0.1:${srv.address().port}`, ...o });
  return { seen, client };
}

const drain = async (it) => {
  const out = [];
  for await (const x of it) out.push(x);
  return out;
};

test("every merchant route of the spec has a method, and the method reaches that route", async (t) => {
  const { seen, client } = await serve(t);
  const c = client();
  const args = {
    createPaymentIntent: [{}],
    createPaymentAttempt: ["pi_A", {}],
    simulatePaymentIntent: ["pi_A", {}],
    advancePaymentIntent: ["pi_A", {}],
    submitDisputeEvidence: ["dp_A", {}],
    fxQuote: [{ from: "THB", to: "USD" }],
  };
  const ids = { paymentIntent: "pi_A", cancelPaymentIntent: "pi_A", listPaymentAttempts: "pi_A", dispute: "dp_A" };
  const methods = new Set(Object.getOwnPropertyNames(Client.prototype).filter((m) => m !== "constructor"));
  for (const r of v.routes) {
    assert.equal(typeof c[r.operation], "function", `no method calls ${r.method} ${r.path}`);
    methods.delete(r.operation);
    const a = args[r.operation] ?? (ids[r.operation] ? [ids[r.operation]] : []);
    const n = seen.length;
    const out = c[r.operation](...a);
    await (Symbol.asyncIterator in out ? drain(out) : out);
    assert.equal(seen.length, n + 1, r.operation);
    const want = new RegExp("^" + r.path.replace(/\{[a-z_]+\}/g, "[^/]+") + "(\\?|$)");
    assert.equal(seen[n].method, r.method, r.operation);
    assert.match(seen[n].url, want, r.operation);
  }
  assert.deepEqual([...methods], [], "methods that are not merchant routes of the spec");
});

test("headers: key, version, generated and caller Idempotency-Key", async (t) => {
  const { seen, client } = await serve(t);
  const c = client();
  await c.createPaymentIntent({ amount: 1, currency: "THB", merchant_order_id: "o" });
  await c.createPaymentIntent({ amount: 1, currency: "THB", merchant_order_id: "o" }, { idempotencyKey: "mine", apiVersion: "2027-01-01" });
  await c.balance();
  const [a, b, g] = seen.map((s) => s.headers);
  assert.equal(a.authorization, "Bearer sk_test_X");
  assert.equal(a["api-version"], API_VERSION);
  assert.ok(a["idempotency-key"].length >= 20);
  assert.equal(a["content-type"], "application/json");
  assert.equal(b["idempotency-key"], "mine");
  assert.equal(b["api-version"], "2027-01-01");
  assert.equal(g["idempotency-key"], undefined);
  assert.equal(g["x-signature"], undefined);
});

test("a query is sorted and encoded once", async (t) => {
  const { seen, client } = await serve(t);
  await drain(client().listPaymentIntents({ status: "succeeded", limit: 50, "created[gte]": "2026-10-01T00:00:00Z" }));
  assert.equal(seen[0].url, "/v1/payment_intents?created%5Bgte%5D=2026-10-01T00%3A00%3A00Z&limit=50&status=succeeded");
});

test("a retry keeps the key and the body and re-signs with a later timestamp", async (t) => {
  const { seen, client } = await serve(t,
    [503, `{"error":{"type":"api_error","code":"service_unavailable","message":"x"}}`, { "Retry-After": "0" }],
    [429, `{"error":{"type":"rate_limit_error","code":"rate_limit_exceeded","message":"x"}}`, { "Retry-After": "0" }],
    [201, `{"id":"pi_A"}`]);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const seed = new Uint8Array(privateKey.export({ format: "der", type: "pkcs8" }).subarray(16));
  const pi = await client({ signer: { scheme: "ed25519", keyId: "key_A", privateKey: seed } })
    .createPaymentIntent({ amount: 1, currency: "THB", merchant_order_id: "o" });
  assert.equal(pi.id, "pi_A");
  assert.equal(seen.length, 3);
  let prev = 0;
  for (const s of seen) {
    assert.equal(s.headers["idempotency-key"], seen[0].headers["idempotency-key"]);
    assert.equal(s.body, seen[0].body);
    const ts = Number(s.headers["x-timestamp"]);
    assert.ok(ts > prev, `timestamp ${ts} after ${prev}`);
    prev = ts;
    const text = [s.headers["x-timestamp"], s.method, s.url, createHash("sha256").update(s.body).digest("hex")].join("\n");
    const sig = Buffer.from(s.headers["x-signature"].replace(/^v2=/, ""), "base64");
    assert.ok(verify(null, Buffer.from(text), publicKey, sig), "signature verifies");
    assert.equal(s.headers["x-key-id"], "key_A");
  }
});

test("a dropped connection is retried", async (t) => {
  const { client } = await serve(t, "drop", [200, `{"available":[]}`]);
  assert.deepEqual(await client().balance(), { available: [] });
});

test("errors carry type, code, param and request id", async (t) => {
  const { seen, client } = await serve(t,
    [422, `{"error":{"type":"idempotency_error","code":"idempotency_key_reused","message":"m","param":"Idempotency-Key","request_id":"req_A"}}`]);
  const err = await client().balance().catch((e) => e);
  assert.ok(err instanceof LemakError);
  assert.deepEqual([err.status, err.type, err.code, err.param, err.requestId], [422, "idempotency_error", "idempotency_key_reused", "Idempotency-Key", "req_A"]);
  assert.equal(seen.length, 1, "a 4xx is not retried");
});

test("a 5xx stops after the retries", async (t) => {
  const r = [500, `{"error":{"type":"api_error","code":"api_error","message":"m"}}`, { "Retry-After": "0", "Request-Id": "req_B" }];
  const { seen, client } = await serve(t, r, r, r);
  const err = await client({ maxRetries: 1 }).balance().catch((e) => e);
  assert.equal(err.code, "api_error");
  assert.equal(err.requestId, "req_B");
  assert.equal(seen.length, 2);
});

test("an attempt times out", async (t) => {
  const { client } = await serve(t, "hang");
  const err = await client({ timeoutMs: 50, maxRetries: 0 }).balance().catch((e) => e);
  assert.equal(err.name, "TimeoutError");
});

test("a list pages with starting_after", async (t) => {
  const { seen, client } = await serve(t,
    [200, `{"object":"list","data":[{"id":"evt_A"},{"id":"evt_B"}],"has_more":true}`],
    [200, `{"object":"list","data":[{"id":"evt_C"}],"has_more":false}`]);
  const ids = (await drain(client().events({ limit: 2 }))).map((e) => e.id);
  assert.deepEqual(ids, ["evt_A", "evt_B", "evt_C"]);
  assert.equal(seen[1].url, "/v1/events?limit=2&starting_after=evt_B");
});
