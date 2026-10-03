/** The theme has twelve presence colours, `--skrum-presence-1` to `-12`. */
export const PresenceSlots = 12;

/**
 * A slot drawn from an id, for a member whose data carries no colour (a page
 * loaded before the server sent one): the same id always gets the same slot.
 */
export function hashedSlot(id: string): number {
    let hash = 0;

    for (const character of id) {
        hash = (hash * 31 + character.charCodeAt(0)) % 360;
    }

    return 1 + (hash % PresenceSlots);
}

function isSlot(presence: number | null | undefined): presence is number {
    return (
        typeof presence === 'number' &&
        Number.isInteger(presence) &&
        presence >= 1 &&
        presence <= PresenceSlots
    );
}

/** The person's colour as the server gives it: one per person, on every session. */
export function presenceOf(member: {
    id: string;
    presence?: number | null;
}): number {
    return isSlot(member.presence) ? member.presence : hashedSlot(member.id);
}

export function presenceVar(slot: number): string {
    return `var(--skrum-presence-${slot})`;
}
