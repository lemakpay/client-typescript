import { base64, concat, sha256hex, unhex, utf8 } from "./bytes.js";
/** Where a Client sends requests when baseURL is not set. */
export const DEFAULT_BASE_URL = "https://api.lemak.cash";
/** The version these types describe, sent as Api-Version unless the client names another. */
export const API_VERSION = "2026-09-01";
const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30_000;
// The backoff doubles from BASE to CAP, and each wait is drawn from its upper half so that
// clients that failed together do not retry together.
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
/** An error response from the API. Use code to handle a specific error. */
export class LemakError extends Error {
    status;
    type;
    code;
    param;
    requestId;
    constructor(status, body, requestId) {
        const e = body?.error;
        const code = e?.code ?? `http_${status}`;
        super(`lemak: ${status} ${code}${e?.message ? ": " + e.message : ""}`);
        this.name = "LemakError";
        this.status = status;
        this.type = e?.type;
        this.code = code;
        this.param = e?.param;
        this.requestId = e?.request_id ?? requestId ?? undefined;
    }
}
/** The string both request schemes sign. */
export async function canonical(timestamp, method, path, body) {
    return [timestamp, method, path, await sha256hex(body)].join("\n");
}
// PKCS#8 wraps a raw 32-byte Ed25519 seed; WebCrypto imports no raw private key.
const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
/** Signs one canonical string and returns the X-Signature and X-Key-Id values. */
export async function sign(signer, text) {
    if (signer.scheme === "hmac_sha256") {
        const raw = unhex(signer.secret);
        if (raw === null)
            throw new TypeError("lemak: the signing secret is not hex");
        const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        return { signature: "v1=" + base64(await crypto.subtle.sign("HMAC", key, utf8(text))) };
    }
    if ("sign" in signer) {
        const sig = await signer.sign(utf8(text));
        if (sig.length !== 64)
            throw new TypeError(`lemak: an Ed25519 signature is 64 bytes, got ${sig.length}`);
        return { signature: "v2=" + base64(sig), keyId: signer.keyId };
    }
    let key = signer.privateKey;
    if (key instanceof Uint8Array) {
        if (key.length !== 32)
            throw new TypeError("lemak: an Ed25519 seed is 32 bytes");
        key = await crypto.subtle.importKey("pkcs8", concat(PKCS8_ED25519, key), { name: "Ed25519" }, false, ["sign"]);
    }
    return { signature: "v2=" + base64(await crypto.subtle.sign("Ed25519", key, utf8(text))), keyId: signer.keyId };
}
export class Client {
    #opts;
    constructor(opts) {
        if (!opts.apiKey)
            throw new TypeError("lemak: apiKey is required");
        this.#opts = opts;
    }
    createPaymentIntent(body, opts) {
        return this.#request("POST", "/v1/payment_intents", undefined, body, opts);
    }
    /** Every payment intent the filter matches, newest first, fetched page by page. */
    listPaymentIntents(query, opts) {
        return this.#pages("/v1/payment_intents", query, opts);
    }
    paymentIntent(id, opts) {
        return this.#request("GET", `/v1/payment_intents/${encodeURIComponent(id)}`, undefined, undefined, opts);
    }
    cancelPaymentIntent(id, opts) {
        return this.#request("POST", `/v1/payment_intents/${encodeURIComponent(id)}/cancel`, undefined, undefined, opts);
    }
    createPaymentAttempt(id, body, opts) {
        return this.#request("POST", `/v1/payment_intents/${encodeURIComponent(id)}/attempts`, undefined, body, opts);
    }
    /** Every attempt on one intent, oldest first. The list has no cursor. */
    listPaymentAttempts(id, opts) {
        return this.#request("GET", `/v1/payment_intents/${encodeURIComponent(id)}/attempts`, undefined, undefined, opts);
    }
    /** Test mode only: report an outcome for the intent. */
    simulatePaymentIntent(id, body, opts) {
        return this.#request("POST", `/v1/test/payment_intents/${encodeURIComponent(id)}/simulate`, undefined, body, opts);
    }
    /** Test mode only: move one timer of the intent to now. */
    advancePaymentIntent(id, body, opts) {
        return this.#request("POST", `/v1/test/payment_intents/${encodeURIComponent(id)}/advance`, undefined, body, opts);
    }
    listDisputes(query, opts) {
        return this.#pages("/v1/disputes", query, opts);
    }
    dispute(id, opts) {
        return this.#request("GET", `/v1/disputes/${encodeURIComponent(id)}`, undefined, undefined, opts);
    }
    submitDisputeEvidence(id, body, opts) {
        return this.#request("POST", `/v1/disputes/${encodeURIComponent(id)}/evidence`, undefined, body, opts);
    }
    /** Requests a settlement of the available balance. Available only on a manual settlement schedule. */
    createSettlement(opts) {
        return this.#request("POST", "/v1/settlements", undefined, undefined, opts);
    }
    balance(opts) {
        return this.#request("GET", "/v1/balance", undefined, undefined, opts);
    }
    /** An indicative rate. The rate a payment uses is fixed at its lock point. */
    fxQuote(query, opts) {
        return this.#request("GET", "/v1/fx/quotes", query, undefined, opts);
    }
    /** The events behind the webhook deliveries, newest first, fetched page by page. */
    events(query, opts) {
        return this.#pages("/v1/events", query, opts);
    }
    /** The platform keys the v2 webhook signature verifies against. */
    webhookPublicKeys(opts) {
        return this.#request("GET", "/v1/webhook_public_keys", undefined, undefined, opts);
    }
    async *#pages(path, query, opts) {
        const q = { ...query };
        for (;;) {
            const page = await this.#request("GET", path, q, undefined, opts);
            const data = page.data ?? [];
            yield* data;
            const last = data.at(-1);
            if (!page.has_more || last === undefined)
                return;
            q.starting_after = last.id;
        }
    }
    async #request(method, path, query, body, opts = {}) {
        const o = this.#opts;
        const qs = new URLSearchParams(Object.entries(query ?? {})
            .filter((e) => e[1] !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => [k, String(v)])).toString();
        const target = qs ? `${path}?${qs}` : path;
        const bytes = body === undefined ? new Uint8Array(0) : utf8(JSON.stringify(body));
        const headers = {
            Authorization: `Bearer ${o.apiKey}`,
            "Api-Version": opts.apiVersion ?? o.apiVersion ?? API_VERSION,
        };
        if (body !== undefined)
            headers["Content-Type"] = "application/json";
        if (method === "POST")
            headers["Idempotency-Key"] = opts.idempotencyKey ?? crypto.randomUUID();
        const doFetch = o.fetch ?? globalThis.fetch;
        const retries = o.maxRetries ?? DEFAULT_RETRIES;
        let signedAt = 0;
        for (let attempt = 0;; attempt++) {
            const last = attempt >= retries;
            // Ed25519 is deterministic, so a retry inside the same second would repeat the
            // signature and be refused as a replay. One second ahead is well inside the skew.
            signedAt = Math.max(Math.floor(Date.now() / 1000), signedAt + 1);
            const h = { ...headers };
            if (o.signer) {
                const ts = String(signedAt);
                const s = await sign(o.signer, await canonical(ts, method, target, bytes));
                h["X-Timestamp"] = ts;
                h["X-Signature"] = s.signature;
                if (s.keyId)
                    h["X-Key-Id"] = s.keyId;
            }
            const timeout = AbortSignal.timeout(o.timeoutMs ?? DEFAULT_TIMEOUT_MS);
            const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
            let res;
            let text;
            try {
                res = await doFetch((o.baseURL?.replace(/\/+$/, "") ?? DEFAULT_BASE_URL) + target, {
                    method,
                    headers: h,
                    body: body === undefined ? undefined : bytes,
                    signal,
                });
                text = await res.text();
            }
            catch (err) {
                if (last || opts.signal?.aborted)
                    throw err;
                await sleep(backoff(attempt), opts.signal);
                continue;
            }
            let parsed = null;
            try {
                parsed = text ? JSON.parse(text) : null;
            }
            catch {
                parsed = null;
            }
            if (res.status === 429 || res.status >= 500) {
                if (last)
                    throw new LemakError(res.status, parsed, res.headers.get("Request-Id"));
                await sleep(retryAfter(res.headers.get("Retry-After"), attempt), opts.signal);
                continue;
            }
            if (res.status >= 400)
                throw new LemakError(res.status, parsed, res.headers.get("Request-Id"));
            return parsed;
        }
    }
}
function backoff(attempt) {
    const d = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
    return d / 2 + Math.random() * (d / 2);
}
function retryAfter(v, attempt) {
    if (v !== null && /^\d+$/.test(v))
        return Number(v) * 1000;
    const at = v === null ? NaN : Date.parse(v);
    return Number.isNaN(at) ? backoff(attempt) : Math.max(at - Date.now(), 0);
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted)
            return reject(signal.reason);
        const t = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
    });
}
