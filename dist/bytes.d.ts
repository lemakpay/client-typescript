export declare const utf8: (s: string) => Uint8Array<ArrayBuffer>;
export declare function hex(b: ArrayBuffer | Uint8Array): string;
export declare function unhex(s: string): Uint8Array<ArrayBuffer> | null;
export declare function base64(b: ArrayBuffer | Uint8Array): string;
export declare function unbase64(s: string): Uint8Array<ArrayBuffer> | null;
export declare function sha256hex(b: Uint8Array<ArrayBuffer>): Promise<string>;
export declare function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer>;
