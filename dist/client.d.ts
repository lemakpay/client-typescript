import type { components, operations } from "./spec.js";
type Schemas = components["schemas"];
export type PaymentIntent = Schemas["PaymentIntent"];
export type PaymentIntentCreate = Schemas["PaymentIntentCreate"];
export type PaymentIntentStatus = Schemas["PaymentIntentStatus"];
export type PresentmentDetails = Schemas["PresentmentDetails"];
export type PaymentIntentInvoice = Schemas["PaymentIntentInvoice"];
export type PaymentIntentReceipt = Schemas["PaymentIntentReceipt"];
export type PaymentIntentSimulate = Schemas["PaymentIntentSimulate"];
export type PaymentIntentAdvance = Schemas["PaymentIntentAdvance"];
export type PaymentAttempt = Schemas["PaymentAttempt"];
export type PaymentAttemptList = Schemas["PaymentAttemptList"];
export type PaymentAttemptCreate = NonNullable<operations["createPaymentAttempt"]["requestBody"]>["content"]["application/json"];
export type Dispute = Schemas["Dispute"];
export type DisputeEvidence = Schemas["DisputeEvidence"];
export type DisputeEvidenceFileKey = (typeof EVIDENCE_FILE_KEYS)[number];
export type File = Schemas["File"];
export type FilePurpose = Schemas["FilePurpose"];
export type FileType = Schemas["FileType"];
export type Refund = Schemas["Refund"];
export type RefundCreate = Schemas["RefundCreate"];
export type RefundStatus = Schemas["RefundStatus"];
export type RefundReason = Schemas["RefundReason"];
export type ListRefundsQuery = NonNullable<operations["listRefunds"]["parameters"]["query"]>;
export type BalanceTransaction = Schemas["BalanceTransaction"];
export type BalanceTransactionType = Schemas["BalanceTransactionType"];
export type BalanceTransactionBalanceType = BalanceTransaction["balance_type"];
export type ListBalanceTransactionsQuery = NonNullable<operations["listBalanceTransactions"]["parameters"]["query"]>;
export type StatementQuery = operations["statement"]["parameters"]["query"];
export type Settlement = Schemas["Settlement"];
export type SettlementCreate = Schemas["SettlementCreate"];
export type MerchantRequest = Schemas["MerchantRequest"];
export type DeclineCode = NonNullable<Schemas["Error"]["decline_code"]>;
export type SettlementItem = Schemas["SettlementItem"];
export type Balance = Schemas["Balance"];
export type FxQuote = Schemas["FxQuote"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type PaymentMethodList = Schemas["PaymentMethodList"];
export type TransactionLimits = Schemas["TransactionLimits"];
export type CurrencyDetails = Schemas["CurrencyDetails"];
export type CurrencyList = Schemas["CurrencyList"];
export type ListPaymentMethodsQuery = NonNullable<operations["listPaymentMethods"]["parameters"]["query"]>;
export type Event = Schemas["Event"];
export type WebhookPublicKeyList = Schemas["WebhookPublicKeyList"];
export type Money = Schemas["Money"];
export type ErrorType = Schemas["Error"]["type"];
export type ListPaymentIntentsQuery = NonNullable<operations["listPaymentIntents"]["parameters"]["query"]>;
export type ListDisputesQuery = NonNullable<operations["listDisputes"]["parameters"]["query"]>;
export type ListSettlementsQuery = NonNullable<operations["listSettlements"]["parameters"]["query"]>;
export type EventsQuery = NonNullable<operations["events"]["parameters"]["query"]>;
export type FxQuoteQuery = operations["fxQuote"]["parameters"]["query"];
/** The DisputeEvidence keys that take the ID of a file uploaded with purpose dispute_evidence. */
export declare const EVIDENCE_FILE_KEYS: readonly ["receipt", "customer_communication", "shipping_documentation", "uncategorized_file"];
/** Where a Client sends requests when baseURL is not set. */
export declare const DEFAULT_BASE_URL = "https://api.lemak.cash";
/** The version these types describe, sent as Api-Version unless the client names another. */
export declare const API_VERSION = "2026-10-23";
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
    /** The secret API key, sk_test_… or sk_live_…, or a withdrawal key, wk_test_… or wk_live_…, which createSettlement needs in production. */
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
    /** Set on payment_blocked alone: the kind of risk rule that declined the payment. */
    readonly declineCode: DeclineCode | undefined;
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
    /** Accepts the dispute: it moves to lost and takes no further evidence. */
    closeDispute(id: string, opts?: RequestOptions): Promise<Dispute>;
    /**
     * Withdraws from the available balance. Without a body it pays every released payment to the
     * default destination. When the account's policy holds the withdrawal for a second approver,
     * the answer is the pending request: check `object === "merchant_request"`. In production it
     * takes a withdrawal key, wk_live_….
     */
    createSettlement(body?: SettlementCreate, opts?: RequestOptions): Promise<Settlement | MerchantRequest>;
    /** The settlements in the key's mode, newest first. Each one leaves out its items; `settlement` returns them. */
    listSettlements(query?: ListSettlementsQuery, opts?: RequestOptions): AsyncGenerator<Settlement>;
    /** One settlement, with the payment intents it pays in `items`. */
    settlement(id: string, opts?: RequestOptions): Promise<Settlement>;
    /** Uploads a PDF, a JPEG or a PNG of at most 5 MB. The signature covers the multipart body as sent. */
    createFile(params: {
        file: Blob | Uint8Array<ArrayBuffer>;
        filename: string;
        purpose: FilePurpose;
    }, opts?: RequestOptions): Promise<File>;
    file(id: string, opts?: RequestOptions): Promise<File>;
    /** Refunds a succeeded payment intent, in whole or in part. */
    createRefund(body: RefundCreate, opts?: RequestOptions): Promise<Refund>;
    /** The refunds the filter matches, newest first, fetched page by page. */
    listRefunds(query?: ListRefundsQuery, opts?: RequestOptions): AsyncGenerator<Refund>;
    refund(id: string, opts?: RequestOptions): Promise<Refund>;
    /** Every movement of the balance, newest first, fetched page by page. */
    listBalanceTransactions(query?: ListBalanceTransactionsQuery, opts?: RequestOptions): AsyncGenerator<BalanceTransaction>;
    /** The statement of one month as it is served: CSV or HTML text, by `format`. */
    statement(query: StatementQuery, opts?: RequestOptions): Promise<string>;
    balance(opts?: RequestOptions): Promise<Balance>;
    /** An indicative rate. The rate a payment uses is fixed at its lock point. */
    fxQuote(query: FxQuoteQuery, opts?: RequestOptions): Promise<FxQuote>;
    /** The payment methods the key's mode can use, each with the currencies it serves. */
    listPaymentMethods(query?: ListPaymentMethodsQuery, opts?: RequestOptions): Promise<PaymentMethodList>;
    /** The currencies you can charge in, quote and settle in, with their exponents. */
    listCurrencies(opts?: RequestOptions): Promise<CurrencyList>;
    /** The events behind the webhook deliveries, newest first, fetched page by page. */
    events(query?: EventsQuery, opts?: RequestOptions): AsyncGenerator<Event>;
    /** The platform keys the v2 webhook signature verifies against. */
    webhookPublicKeys(opts?: RequestOptions): Promise<WebhookPublicKeyList>;
}
export {};
