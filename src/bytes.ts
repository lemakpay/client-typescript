// WebCrypto and the encodings it needs, with nothing from Node, so the SDK runs on Node,
// Cloudflare Workers, Deno and in a browser alike.

export const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);

export function hex(b: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}

// Strict: an even count of hex digits and nothing else, as Go's hex.DecodeString.
export function unhex(s: string): Uint8Array<ArrayBuffer> | null {
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function base64(b: ArrayBuffer | Uint8Array): string {
  let s = "";
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s);
}

// Padded standard base64 only: atob alone also takes unpadded text and whitespace.
export function unbase64(s: string): Uint8Array<ArrayBuffer> | null {
  if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function sha256hex(b: Uint8Array<ArrayBuffer>): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", b));
}

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
