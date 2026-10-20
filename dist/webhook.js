import { concat, unbase64, unhex, utf8 } from "./bytes.js";
/** The header that carries both signatures of a delivery. */
export const WEBHOOK_HEADER = "X-Webhook-Signature";
/** The maximum difference, in seconds, between a delivery's timestamp and the current time. */
export const WEBHOOK_TOLERANCE = 300;
/** Why a delivery was refused: a bad or missing signature, or a timestamp out of tolerance. */
export class WebhookError extends Error {
    reason;
    constructor(reason, message) {
        super(`lemak: webhook ${message}`);
        this.name = "WebhookError";
        this.reason = reason;
    }
}
/** Converts the result of webhookPublicKeys() into WebhookKeys.publicKeys. */
export function publicKeyMap(list) {
    return Object.fromEntries(list.data.map((k) => [k.id, k.public_key]));
}
/**
 * Checks the X-Webhook-Signature header of one delivery against the raw body exactly as it
 * arrived. Resolves when the delivery is good and rejects with a WebhookError when it is not.
 * now is Unix seconds. Unknown header fields are ignored.
 */
export async function verifyWebhook(header, rawBody, keys, now = Date.now() / 1000) {
    const f = new Map();
    for (const field of header.split(",")) {
        const s = field.trim();
        const i = s.indexOf("=");
        if (i < 0)
            throw new WebhookError("signature", `field ${JSON.stringify(field)} is not k=v`);
        f.set(s.slice(0, i), s.slice(i + 1));
    }
    const t = f.get("t") ?? "";
    if (!/^[+-]?\d+$/.test(t))
        throw new WebhookError("signature", `timestamp ${JSON.stringify(t)} is not a number`);
    if (Math.abs(now - Number(t)) > WEBHOOK_TOLERANCE)
        throw new WebhookError("stale", "timestamp outside the tolerance");
    const msg = concat(utf8(t + "."), typeof rawBody === "string" ? utf8(rawBody) : rawBody);
    let checked = false;
    if (keys.secret) {
        const secret = unhex(keys.secret);
        const v1 = unhex(f.get("v1") ?? "");
        if (secret === null)
            throw new WebhookError("signature", "endpoint secret is not hex");
        if (v1 === null)
            throw new WebhookError("signature", "v1 is not hex");
        const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        // verify compares in constant time.
        if (!(await crypto.subtle.verify("HMAC", key, v1, msg)))
            throw new WebhookError("signature", "v1 does not match");
        checked = true;
    }
    const b64 = keys.publicKeys?.[f.get("v2_kid") ?? ""];
    if (b64 !== undefined) {
        const raw = unbase64(b64);
        if (raw === null || raw.length !== 32)
            throw new WebhookError("signature", "public key is not 32 bytes of base64");
        const sig = unbase64(f.get("v2") ?? "");
        if (sig === null)
            throw new WebhookError("signature", "v2 is not base64");
        const key = await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
        if (!(await crypto.subtle.verify("Ed25519", key, sig, msg)))
            throw new WebhookError("signature", "v2 does not match");
        checked = true;
    }
    if (!checked)
        throw new WebhookError("signature", "no key to verify with");
}
/** Every event type the platform delivers. */
export const EVENT_TYPES = [
    "payment_intent.created",
    "payment_intent.requires_payment",
    "payment_intent.processing",
    "payment_intent.succeeded",
    "payment_intent.channel_settled",
    "payment_intent.failed",
    "payment_intent.expired",
    "payment_intent.canceled",
    "payment_intent.finalized",
    "payment_intent.reversed",
    "settlement.pending",
    "settlement.processing",
    "settlement.paid",
    "settlement.failed",
    "dispute.opened",
    "dispute.updated",
    "dispute.closed",
];
/** Decodes a verified delivery body. Unknown fields are kept and ignored. */
export function parseEvent(rawBody) {
    const text = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
    const e = JSON.parse(text);
    if (typeof e?.id !== "string" || typeof e.type !== "string" || typeof e.data !== "object" || e.data === null) {
        throw new TypeError("lemak: the body is not an event");
    }
    return e;
}
