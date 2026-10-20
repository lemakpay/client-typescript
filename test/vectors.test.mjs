// The same values the Go client tests against: testdata/vectors.json, written by the Lemak API
// server's own signing code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { API_VERSION, EVENT_TYPES, WebhookError, canonical, parseEvent, sign, verifyWebhook } from "../dist/index.js";

const here = new URL(".", import.meta.url).pathname;
const v = JSON.parse(readFileSync(join(here, "../testdata/vectors.json"), "utf8"));
const seed = Uint8Array.from(v.ed25519_seed.match(/../g), (h) => parseInt(h, 16));

for (const r of v.requests) {
  test(`request: ${r.name}`, async () => {
    const c = await canonical(r.timestamp, r.method, r.path, new TextEncoder().encode(r.body));
    assert.equal(c, r.canonical);
    assert.deepEqual(await sign({ scheme: "hmac_sha256", secret: v.hmac_secret }, c), { signature: r.v1 });
    assert.deepEqual(await sign({ scheme: "ed25519", keyId: v.key_id, privateKey: seed }, c), { signature: r.v2, keyId: v.key_id });
    const pkcs8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20, ...seed]);
    const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
    const remote = { scheme: "ed25519", keyId: v.key_id, sign: async (m) => new Uint8Array(await crypto.subtle.sign("Ed25519", key, m)) };
    assert.deepEqual(await sign(remote, c), { signature: r.v2, keyId: v.key_id });
  });
}

for (const w of v.webhooks) {
  test(`webhook: ${w.name}`, async () => {
    let got = "ok";
    try {
      await verifyWebhook(w.header, w.body, { secret: w.secret, publicKeys: w.public_keys }, w.now);
    } catch (e) {
      assert.ok(e instanceof WebhookError, `err = ${e}, want a WebhookError`);
      got = e.reason;
    }
    assert.equal(got, w.want);
  });
}

test("a raw Uint8Array body verifies as its string does", async () => {
  const w = v.webhooks[0];
  await verifyWebhook(w.header, new TextEncoder().encode(w.body), { secret: w.secret }, w.now);
});

test("parseEvent reads the delivered body and keeps unknown fields", () => {
  const e = parseEvent(v.webhooks[0].body);
  assert.equal(e.type, "payment_intent.succeeded");
  assert.equal(e.data.object, "payment_intent");
  assert.equal(e.livemode, false);
  assert.throws(() => parseEvent(`{"hello":1}`));
});

test("the constants are the server's", () => {
  assert.equal(API_VERSION, v.api_version);
  assert.deepEqual([...EVENT_TYPES], v.event_types);
});

