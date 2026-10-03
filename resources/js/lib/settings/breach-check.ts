const PrefixLength = 5;

/**
 * The SHA-1 of the text in upper-case hex, or null where the browser offers
 * no `crypto.subtle` (a page served over plain HTTP).
 */
export async function sha1Hex(text: string): Promise<string | null> {
    const subtle = globalThis.crypto?.subtle;

    if (subtle === undefined) {
        return null;
    }

    const digest = await subtle.digest('SHA-1', new TextEncoder().encode(text));

    return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
    )
        .join('')
        .toUpperCase();
}

/** k-anonymity: only the prefix leaves the browser, the suffix is compared here. */
export function splitHash(hash: string): { prefix: string; suffix: string } {
    return {
        prefix: hash.slice(0, PrefixLength),
        suffix: hash.slice(PrefixLength),
    };
}

export function isBreached(suffixes: string[], suffix: string): boolean {
    const wanted = suffix.toUpperCase();

    return suffixes.some((candidate) => candidate.toUpperCase() === wanted);
}
