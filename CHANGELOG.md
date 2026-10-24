# Changelog

All notable changes to this package are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0.0, a minor version can
change a method's shape; each such change is listed under **Changed** with how to migrate.

## [0.7.1] - 2026-10-24

### Changed

- The error documentation states that a test mode key takes at most 5 requests a second. Over
  the limit is 429 `rate_limit_exceeded`, which the client retries after `Retry-After`.

## [0.7.0] - 2026-10-23

### Added

- `listIps` returns the addresses webhook deliveries leave from, for a firewall allow-list. The
  webhook signature stays the control; the list is empty until published.

## [0.6.0] - 2026-10-23

### Added

- Refunds: `createRefund`, `refund` and `listRefunds`.
- Dispute evidence files: `createFile` uploads a PDF, JPEG or PNG of at most 5 MB as
  `multipart/form-data` and signs the multipart bytes as sent; `file` reads the file object.
- `closeDispute` accepts a dispute. The dispute moves to `lost`.
- `EVIDENCE_FILE_KEYS` and the `DisputeEvidenceFileKey` type: the `DisputeEvidence` keys that
  take a file ID.
- `listBalanceTransactions` iterates over every movement of the balance.
- `statement` returns the CSV or HTML statement of one month as text.
- Withdrawals: `createSettlement` takes an optional `SettlementCreate` body (`amount`,
  `currency`, `payout_method`).
- Withdrawal keys (`wk_test_...`, `wk_live_...`) work as `apiKey`. In production,
  `createSettlement` needs one.
- `LemakError.declineCode`, set on `payment_blocked`: `velocity`, `blocklist`, `geo`, `amount`
  or `generic`.
- The event types `refund.created`, `refund.succeeded` and `refund.failed`.

### Changed

- **Breaking:** `createSettlement(body?, opts?)` takes the body first and returns
  `Promise<Settlement | MerchantRequest>`. A call that passed request options moves them to the
  second argument: `createSettlement(undefined, opts)`. When an approval policy holds the
  withdrawal for a second approver, the answer is the pending request: check
  `object === "merchant_request"`.
- `API_VERSION` is `2026-10-23`, and every request sends it as `Api-Version` unless the client
  or the request names another version. At `2026-10-23` the evidence keys that take a file must
  name a file uploaded with purpose `dispute_evidence`, or the request fails with
  `invalid_evidence_file`. To keep sending free text under those keys, set `apiVersion` to
  `2026-09-01`.

## [0.5.0] - 2026-10-22

### Added

- Invoices and receipts.

## [0.4.0] - 2026-10-22

### Added

- Transaction limits and presentment details.

## [0.3.1] - 2026-10-21

### Removed

- The unused channel field of `createPaymentAttempt`.

## [0.3.0] - 2026-10-21

### Added

- `listSettlements` and `settlement`.
- `listPaymentMethods` and `listCurrencies`.
- The `no_pending_attempt` error of `simulatePaymentIntent` is documented.

## [0.2.0] - 2026-10-21

### Added

- Automatic currency conversion.

## [0.1.0] - 2026-10-20

- Initial release.

[0.6.0]: https://github.com/lemakpay/client-typescript/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/lemakpay/client-typescript/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/lemakpay/client-typescript/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/lemakpay/client-typescript/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/lemakpay/client-typescript/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/lemakpay/client-typescript/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lemakpay/client-typescript/releases/tag/v0.1.0
