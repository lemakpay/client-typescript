# Lemak TypeScript Library

The Lemak TypeScript library provides access to the Lemak API from server-side JavaScript and
TypeScript. It covers every `/v1` endpoint, signs requests, retries safely and verifies webhook
signatures. It has no runtime dependencies and uses only `fetch` and Web Crypto, so it runs on
Node.js, Cloudflare Workers and Deno.

## Requirements

Node.js 20.3 or later.

## Installation

```sh
npm install github:lemakpay/client-typescript#v0.1.0
```

## Usage

```ts
import { Client } from "@lemakpay/client";

const lemak = new Client({ apiKey: "sk_test_..." });

const paymentIntent = await lemak.createPaymentIntent({
  amount: 100000, // 1,000.00 THB, in minor units
  currency: "THB",
  merchant_order_id: "order-1001",
  payment_method: "promptpay",
});
```

List methods return an async iterator that fetches pages as needed:

```ts
for await (const pi of lemak.listPaymentIntents({ status: "succeeded" })) {
  console.log(pi.id);
}
```

### Request signing

If your account requires signed requests, pass a signer:

```ts
const lemak = new Client({
  apiKey: "sk_live_...",
  signer: { scheme: "ed25519", keyId: "key_...", privateKey },
});
```

To keep the private key in AWS KMS or a hardware security module, pass a `sign` function instead
of `privateKey`. With an AWS KMS key of spec `ECC_NIST_EDWARDS25519`:

```ts
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

const kms = new KMSClient({});
const lemak = new Client({
  apiKey: "sk_live_...",
  signer: {
    scheme: "ed25519",
    keyId: "key_...",
    sign: async (message) => {
      const out = await kms.send(new SignCommand({
        KeyId: kmsKeyId,
        Message: message,
        MessageType: "RAW",
        SigningAlgorithm: "ED25519_SHA_512",
      }));
      return out.Signature!;
    },
  },
});
```

Register the key's public key in the dashboard. `GetPublicKey` returns it DER-encoded; the
last 32 bytes are the raw Ed25519 public key.

### Idempotency and retries

Every POST request is sent with an `Idempotency-Key`. To set your own, pass `idempotencyKey` in
the request options. Network errors, `429` and `5xx` responses are retried twice with the same key.

### Errors

API errors are thrown as `LemakError`, with `status`, `type`, `code`, `param` and `requestId`.

### Webhooks

Verify the signature against the raw request body before you use an event:

```ts
import { verifyWebhook, parseEvent } from "@lemakpay/client";

await verifyWebhook(request.headers.get("X-Webhook-Signature"), rawBody, {
  secret: endpointSecret,
}); // throws WebhookError if the signature is invalid
const event = parseEvent(rawBody);
```

## Documentation

See the [API reference](https://lemak.cash/docs/) and the
[SDK guide](https://lemak.cash/docs/sdks.html).

## License

MIT
