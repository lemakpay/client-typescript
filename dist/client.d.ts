import type { components, operations } from "./spec.js";
type Schemas = components["schemas"];
export type PaymentIntent = Schemas["PaymentIntent"];
export type PaymentIntentCreate = Schemas["PaymentIntentCreate"];
export type PaymentIntentStatus = Schemas["PaymentIntentStatus"];
export type PaymentIntentSimulate = Schemas["PaymentIntentSimulate"];
export type PaymentIntentAdvance = Schemas["PaymentIntentAdvance"];
export type PaymentAttempt = Schemas["PaymentAttempt"];
export type PaymentAttemptList = Schemas["PaymentAttemptList"];
export type PaymentAttemptCreate = NonNullable<operations["createPaymentAttempt"]["requestBody"]>["content"]["application/json"];
export type Dispute = Schemas["Dispute"];
export type DisputeEvidence = Schemas["DisputeEvidence"];
export type Settlement = Schemas["Settlement"];
export type Balance = Schemas["Balance"];
export type FxQuote = Schemas["FxQuote"];
export type Event = Schemas["Event"];
export type WebhookPublicKeyList = Schemas["WebhookPublicKeyList"];
export type Money = Schemas["Money"];
export type ErrorType = Schemas["Error"]["type"];
export type ListPaymentIntentsQuery = NonNullable<operations["listPaymentIntents"]["parameters"]["query"]>;
export type ListDisputesQuery = NonNullable<operations["listDisputes"]["parameters"]["query"]>;
export type EventsQuery = NonNullable<operations["events"]["parameters"]["query"]>;
export type FxQuoteQuery = operations["fxQuote"]["parameters"]["query"];
/** Where a Client sends requests when baseURL is not set. */
export declare const DEFAULT_BASE_URL = "https://api.lemak.cash";
/** The version these types describe, sent as Api-Version unless the client names another. */
export declare const API_VERSION = "2026-09-01";
/** How requests are signed when the account requires a signature_scheme. */
export type Signer = {
    scheme: "hmac_sha256";
    secret: string;
} | {
    scheme: "ed25519";
    keyId: string;
    privateKey: CryptoKey | Uint8Array;
}
/** A key held outside the process, such as in AWS KMS. sign returns the 64-byte Ed25519 signature. */
 | {
    scheme: "ed25519";
    keyId: string;
    sign: (message: Uint8Array) => Promise<Uint8Array>;
};
export interface ClientOptions {
    /** The secret API key, sk_test_… or sk_live_…. */
    apiKey: string;
    baseURL?: string;
    apiVersion?: string;
    signer?: Signer;
    /** Retries after a network error, a 429 or a 5xx. Default 2; 0 turns retries off. */
    maxRetries?: number;
    /** Bounds each attempt. Default 30 000. */
    timeoutMs?: number;
    fetch?: typeof fetch;
}
export interface RequestOptions {
    /** Replaces the generated Idempotency-Key of a POST. */
    idempotencyKey?: string;
    apiVersion?: string;
    signal?: AbortSignal;
}
/** An error response from the API. Use code to handle a specific error. */
export declare class LemakError extends Error {
    readonly status: number;
    readonly type: ErrorType | undefined;
    readonly code: string;
    readonly param: string | undefined;
    readonly requestId: string | undefined;
    constructor(status: number, body: unknown, requestId: string | null);
}
/** The string both request schemes sign. */
export declare function canonical(timestamp: string, method: string, path: string, body: Uint8Array<ArrayBuffer>): Promise<string>;
/** Signs one canonical string and returns the X-Signature and X-Key-Id values. */
export declare function sign(signer: Signer, text: string): Promise<{
    signature: string;
    keyId?: string;
}>;
export declare class Client {
    #private;
    constructor(opts: ClientOptions);
    createPaymentIntent(body: PaymentIntentCreate, opts?: RequestOptions): Promise<PaymentIntent>;
    /** Every payment intent the filter matches, newest first, fetched page by page. */
    listPaymentIntents(query?: ListPaymentIntentsQuery, opts?: RequestOptions): AsyncGenerator<PaymentIntent>;
    paymentIntent(id: string, opts?: RequestOptions): Promise<PaymentIntent>;
    cancelPaymentIntent(id: string, opts?: RequestOptions): Promise<PaymentIntent>;
    createPaymentAttempt(id: string, body: PaymentAttemptCreate, opts?: RequestOptions): Promise<PaymentAttempt>;
    /** Every attempt on one intent, oldest first. The list has no cursor. */
    listPaymentAttempts(id: string, opts?: RequestOptions): Promise<PaymentAttemptList>;
    /**
     * Test mode only: report an outcome for the intent. An intent with no pending attempt
     * fails with 409 `no_pending_attempt`: call `createPaymentAttempt`, or let the payer pick
     * a method on the hosted page, first.
     */
    simulatePaymentIntent(id: string, body: PaymentIntentSimulate, opts?: RequestOptions): Promise<PaymentIntent>;
    /** Test mode only: move one timer of the intent to now. */
    advancePaymentIntent(id: string, body: PaymentIntentAdvance, opts?: RequestOptions): Promise<PaymentIntent>;
    listDisputes(query?: ListDisputesQuery, opts?: RequestOptions): AsyncGenerator<Dispute>;
    dispute(id: string, opts?: RequestOptions): Promise<Dispute>;
    submitDisputeEvidence(id: string, body: DisputeEvidence, opts?: RequestOptions): Promise<Dispute>;
    /** Requests a settlement of the available balance. Available only on a manual settlement schedule. */
    createSettlement(opts?: RequestOptions): Promise<Settlement>;
    balance(opts?: RequestOptions): Promise<Balance>;
    /** An indicative rate. The rate a payment uses is fixed at its lock point. */
    fxQuote(query: FxQuoteQuery, opts?: RequestOptions): Promise<FxQuote>;
    /** The events behind the webhook deliveries, newest first, fetched page by page. */
    events(query?: EventsQuery, opts?: RequestOptions): AsyncGenerator<Event>;
    /** The platform keys the v2 webhook signature verifies against. */
    webhookPublicKeys(opts?: RequestOptions): Promise<WebhookPublicKeyList>;
}
export {};
