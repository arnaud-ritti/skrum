/**
 * A random id of lowercase hexadecimal characters. It draws on
 * `crypto.getRandomValues`, which every browser offers, unlike
 * `crypto.randomUUID`, which exists only in a secure context and is missing
 * on an instance served over plain http to a LAN address.
 */
export function randomHexId(length = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, length);
}
