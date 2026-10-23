# Lemak TypeScript Library

The Lemak TypeScript library provides access to the Lemak API from server-side JavaScript and
TypeScript. It covers every `/v1` endpoint, signs requests, retries safely and verifies webhook
signatures. It has no runtime dependencies and uses only `fetch` and Web Crypto, so it runs on
Node.js, Cloudflare Workers and Deno.

## Requirements

Node.js 20.3 or later.

## Installation

```sh
npm install github:lemakpay/client-typescript#v0.6.0
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

### Automatic currency conversion

To price an order in your settlement currency and let the payer pay in theirs, set
`payment_currency`:

```ts
const pi = await lemak.createPaymentIntent({
  amount: 1000, // 10.00 USD, your price
  currency: "USD",
  payment_currency: "THB",
  markup_bearer: "payer",
  merchant_order_id: "order-1002",
  payment_method: "promptpay",
});
// pi.payment_amount is what the payer pays, in THB.
```

The payer pays in another currency and you are paid in yours. The exchange rate is always locked
when the payment intent is created, whatever your lock point setting, and it holds until the
payment intent expires. `currency` must be your settlement currency, and `payment_method` is
required. The response keeps your price in `amount` and `currency`; the payer's side is in
`payment_amount`, and the applied rate, markup included, is in `fx.rate`.

`markup_bearer` decides who pays the conversion markup and your fee:

- `payer` (the default): the payer pays them, so you receive exactly `amount`. The payment
  amount is rounded up to the payment currency's smallest unit.
- `merchant`: the payer pays `amount` converted without markup, rounded up. You receive the
  payment amount less your fee, converted at `fx.rate` and rounded down.

### What the payer is charged

A payment method can charge only in steps and above a minimum. Each method lists these rules per
currency in `transaction_limits`:

```ts
const { data } = await lemak.listPaymentMethods({ currency: "THB" });
for (const m of data) {
  const limits = m.transaction_limits["THB"];
  console.log(m.code, limits?.rounding_increment, limits?.minimum_amount); // minimum_amount is null for none
}
```

The payer's charge is `amount` rounded up to the method's `rounding_increment`, and at least its
`minimum_amount`. `amount` never changes. Once a payment method is chosen, the payment intent
shows the charge in `presentment_details`:

```ts
const { presentment_amount, presentment_currency } = pi.presentment_details ?? {};
```

A method that is not enabled for your account in that currency returns 400
`payment_method_unavailable`.

List methods return an async iterator that fetches pages as needed:

```ts
for await (const pi of lemak.listPaymentIntents({ status: "succeeded" })) {
  console.log(pi.id);
}
```

### Invoices and receipts

Every payment intent carries an invoice. Pass `receipt_email` on create, and the payer gets a
receipt by email when the payment succeeds:

```ts
const pi = await lemak.createPaymentIntent({
  amount: 100000,
  currency: "THB",
  merchant_order_id: "order-1001",
  receipt_email: "payer@example.com",
});

console.log(pi.invoice?.number, pi.invoice?.hosted_invoice_url); // share the URL with the payer
console.log(pi.receipt?.number, pi.receipt?.receipt_url); // present from succeeded on
```

`receipt_email` is not returned. A value that is not one email address returns 400
`invalid_receipt_email`. The hosted invoice and receipt pages have a Download PDF button.

### Refunds

```ts
const refund = await lemak.createRefund({ payment_intent: paymentIntent.id, amount: 50000 });
```

Leave out `amount` to refund all that is left. `listRefunds` and `refund` read refunds back, and
the `refund.created`, `refund.succeeded` and `refund.failed` events report their progress.

### Disputes and evidence files

Upload a file, then name it under one of the file keys of the evidence:

```ts
const file = await lemak.createFile({
  file: await readFile("receipt.pdf"), // a Uint8Array or a Blob
  filename: "receipt.pdf",
  purpose: "dispute_evidence",
});
await lemak.submitDisputeEvidence(disputeId, { evidence: { receipt: file.id } });
```

A file is a PDF, a JPEG or a PNG of at most 5 MB. `EVIDENCE_FILE_KEYS` lists the keys that take
a file. To accept a dispute instead, call `closeDispute`.

### Balance transactions and statements

`listBalanceTransactions` iterates over every movement of your balance. `statement` returns the
statement of one month as CSV or as a printable HTML page:

```ts
const csv = await lemak.statement({ month: "2026-09", format: "csv" });
```

### Withdrawals

On a manual settlement schedule, `createSettlement` withdraws from the available balance. In
production it needs a withdrawal key (`wk_live_...`) as the client's `apiKey`. If your approval
policy holds the withdrawal for a second approver, you get the pending request instead of a
settlement:

```ts
const res = await lemak.createSettlement({ amount: 100000, currency: "USD" });
if (res.object === "merchant_request") console.log("waiting for approval:", res.id);
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
A `payment_blocked` error also carries `declineCode`, the kind of risk rule that declined the
payment.

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
