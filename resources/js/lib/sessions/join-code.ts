import JoinCodesController from '@/actions/App/Http/Controllers/JoinCodesController';

/**
 * A session's join code, as `App\Support\Sessions\JoinCode` reads it: three
 * characters, a hyphen, four characters, from an alphabet without 0, O, 1, I
 * or L. Case, spaces and the hyphen do not matter.
 */
export const JoinCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const Length = 7;
const HeadLength = 3;
const WrittenCode = new RegExp(`^[${JoinCodeAlphabet}]{${Length}}$`);

function compact(input: string): string {
    return input.trim().replace(/[ -]/g, '').toUpperCase();
}

function format(characters: string): string {
    if (characters.length <= HeadLength) {
        return characters;
    }

    return `${characters.slice(0, HeadLength)}-${characters.slice(HeadLength)}`;
}

export function normaliseJoinCode(input: string): string | null {
    const characters = compact(input);

    if (!WrittenCode.test(characters)) {
        return null;
    }

    return format(characters);
}

/** What the field shows while a code is typed: upper case, the hyphen in place. */
export function formatAsTyped(input: string): string {
    const characters = compact(input).slice(0, Length);
    const typedHyphen =
        characters.length === HeadLength && input.trimEnd().endsWith('-');

    return typedHyphen ? `${characters}-` : format(characters);
}

/** 'https://skrum.example/join' → 'skrum.example/join', as the Share dialog shows it. */
export function joinHost(url: string): string {
    return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

/** Where this instance's join-by-code page is, without its scheme. */
export function joinPageHost(): string {
    return joinHost(
        `${window.location.origin}${JoinCodesController.create.url()}`,
    );
}
