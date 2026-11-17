export const parsed: unknown = JSON.parse("{}"); // @expect no-restricted-properties
export const text = JSON.stringify({}); // @expect no-restricted-properties
export const url = new URL("https://example.com"); // @expect no-restricted-syntax
export const decoded = decodeURIComponent("%20"); // @expect no-restricted-globals
export const encoded = encodeURI("a b"); // @expect no-restricted-globals
export const big = BigInt(1); // @expect no-restricted-syntax
export const cloned = structuredClone({}); // @expect no-restricted-globals
export const fromBase64 = atob("aGk="); // @expect no-restricted-globals
export const toBase64 = btoa("hi"); // @expect no-restricted-globals
export const pattern = new RegExp("a+"); // @expect no-restricted-syntax prefer-regex-literals
export const literal = /a+/u;
export const request = (): Promise<Response> => fetch("https://example.com"); // @expect no-restricted-globals
export const aliased = globalThis.fetch; // @expect no-restricted-properties
export const body = (response: Response): Promise<unknown> => response.json(); // @expect no-restricted-syntax
