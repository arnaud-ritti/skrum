/**
 * The preview of the server's `TeamSlug::fromName`. The server derives and
 * decides: its transliteration covers more scripts than this one, which is
 * why a slug the person did not edit is never sent.
 */
export const TeamSlugMaxLength = 50;

export const TeamSlugMinLength = 2;

export const TeamSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const Fallback = 'team';

/** The team link's base as drawn: the instance's address without its scheme. */
export function shownAddressBase(base: string): string {
    return base.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
}

export function slugFromName(name: string): string {
    const words = name
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replaceAll('_', '-')
        .replaceAll('@', '-at-')
        .toLowerCase()
        .replace(/[^-a-z0-9\s]+/g, '')
        .replace(/[-\s]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const slug = cut(words, TeamSlugMaxLength);

    if (slug.length < TeamSlugMinLength) {
        return Fallback;
    }

    return slug;
}

export function isValidTeamSlug(slug: string): boolean {
    return (
        slug.length >= TeamSlugMinLength &&
        slug.length <= TeamSlugMaxLength &&
        TeamSlugPattern.test(slug)
    );
}

function cut(slug: string, length: number): string {
    if (slug.length <= length) {
        return slug;
    }

    const shortened = slug.slice(0, length);
    const lastHyphen = shortened.lastIndexOf('-');

    if (lastHyphen >= TeamSlugMinLength) {
        return shortened.slice(0, lastHyphen);
    }

    return shortened.replace(/-+$/, '');
}
