const StorageKey = 'skrum:recent-emoji';
const MaxRecent = 16;

/** The emoji this person picked last on this browser, most recent first. */
export function readRecent(): string[] {
    try {
        const stored: unknown = JSON.parse(
            window.localStorage.getItem(StorageKey) ?? '[]',
        );

        return Array.isArray(stored)
            ? stored
                  .filter((item): item is string => typeof item === 'string')
                  .slice(0, MaxRecent)
            : [];
    } catch {
        return [];
    }
}

export function pushRecent(emoji: string): string[] {
    try {
        const recent = [
            emoji,
            ...readRecent().filter((item) => item !== emoji),
        ].slice(0, MaxRecent);

        window.localStorage.setItem(StorageKey, JSON.stringify(recent));

        return recent;
    } catch {
        return [];
    }
}
