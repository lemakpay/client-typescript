import type { Money } from "./client.js";
/** The header that carries both signatures of a delivery. */
export declare const WEBHOOK_HEADER = "X-Webhook-Signature";
/** The maximum difference, in seconds, between a delivery's timestamp and the current time. */
export declare const WEBHOOK_TOLERANCE = 300;
/** Why a delivery was refused: a bad or missing signature, or a timestamp out of tolerance. */
export declare class WebhookError extends Error {
    readonly reason: "signature" | "stale";
    constructor(reason: "signature" | "stale", message: string);
}
/**
 * What a receiver verifies with. secret is the endpoint secret, 64 hex characters, and checks
 * v1. publicKeys maps a key id to its base64 public key, as webhookPublicKeys() returns them,
 * and checks v2 against the key the header names in v2_kid. Each half that is given must
 * match, and at least one must be given. A v2_kid not in publicKeys skips v2: fetch the keys
 * again when you meet one.
 */
export interface WebhookKeys {
    secret?: string;
    publicKeys?: Record<string, string>;
}
/** Converts the result of webhookPublicKeys() into WebhookKeys.publicKeys. */
export declare function publicKeyMap(list: {
    data: {
        id: string;
        public_key: string;
    }[];
}): Record<string, string>;
/**
 * Checks the X-Webhook-Signature header of one delivery against the raw body exactly as it
 * arrived. Resolves when the delivery is good and rejects with a WebhookError when it is not.
 * now is Unix seconds. Unknown header fields are ignored.
 */
export declare function verifyWebhook(header: string, rawBody: Uint8Array | string, keys: WebhookKeys, now?: number): Promise<void>;
/** Every event type the platform delivers. */
export declare const EVENT_TYPES: readonly ["payment_intent.created", "payment_intent.requires_payment", "payment_intent.processing", "payment_intent.succeeded", "payment_intent.channel_settled", "payment_intent.failed", "payment_intent.expired", "payment_intent.canceled", "payment_intent.finalized", "payment_intent.reversed", "settlement.pending", "settlement.processing", "settlement.paid", "settlement.failed", "dispute.opened", "dispute.updated", "dispute.closed", "refund.created", "refund.succeeded", "refund.failed"];
export type EventType = (typeof EVENT_TYPES)[number];
/** One delivered event. data is a notice, not the object: read the object before you act. */
export interface WebhookEvent {
    id: string;
    object?: "event";
    /** An unknown type is passed through: compare with EVENT_TYPES and skip what you do not handle. */
    type: EventType | (string & {});
    created: string;
    livemode: boolean;
    data: {
        id: string;
        object: string;
        status: string;
        merchant: string;
        mode: "live" | "test";
        /** Set only on settlement events. */
        amount?: Money;
    };
}
/** Decodes a verified delivery body. Unknown fields are kept and ignored. */
export declare function parseEvent(rawBody: Uint8Array | string): WebhookEvent;
