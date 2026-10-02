import type { PresenceMember } from '@/lib/retro/types';

/** The theme has twelve presence colours, `--skrum-presence-1` to `-12`. */
export const PresenceSlots = 12;

/** The same member has the same colour on every screen: avatar ring and cursor. */
export function presenceSlot(memberId: string): number {
    let hash = 0;

    for (const character of memberId) {
        hash = (hash * 31 + character.charCodeAt(0)) % 360;
    }

    return 1 + (hash % PresenceSlots);
}

export function presenceFor(member: PresenceMember): number {
    return presenceSlot(member.id);
}

/**
 * The canvas draws cursors itself and needs a colour value, not a class: the
 * presence token is read from the document, so it follows the theme.
 */
export function presenceCursorColor(memberId: string): {
    background: string;
    stroke: string;
} {
    const slot = presenceSlot(memberId);
    const styles = getComputedStyle(document.documentElement);
    const background = styles
        .getPropertyValue(`--skrum-presence-${slot}`)
        .trim();
    const stroke = styles
        .getPropertyValue(`--skrum-presence-${slot}-foreground`)
        .trim();

    return {
        background: background || 'currentColor',
        stroke: stroke || background || 'currentColor',
    };
}
