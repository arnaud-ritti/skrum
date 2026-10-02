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

type CursorColor = { background: string; stroke: string };

const cursorColors = new Map<string, CursorColor>();

/** Called when the theme changes: the tokens are read again. */
export function forgetPresenceCursorColors(): void {
    cursorColors.clear();
}

/**
 * In the dark theme the library draws every canvas through
 * `invert(93%) hue-rotate(180deg)`. This is the colour (0 to 255 per channel)
 * that the filter turns back into the one given, as near as the filter can
 * reach: a rotation by half a turn undoes itself.
 */
export function compensateDarkFilter([red, green, blue]: number[]): number[] {
    const [r, g, b] = [red / 255, green / 255, blue / 255];

    return [
        -0.574 * r + 1.43 * g + 0.144 * b,
        0.426 * r + 0.43 * g + 0.144 * b,
        0.426 * r + 1.43 * g - 0.856 * b,
    ].map((channel) =>
        Math.round(Math.min(1, Math.max(0, (0.93 - channel) / 0.86)) * 255),
    );
}

/** The channels the browser paints for a CSS colour, or null when it cannot say. */
function paintedChannels(color: string): number[] | null {
    const context = document.createElement('canvas').getContext('2d');

    if (!context) {
        return null;
    }

    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);

    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
}

function forCanvas(token: string, dark: boolean): string {
    if (!dark || token === '') {
        return token;
    }

    const channels = paintedChannels(token);

    return channels
        ? `rgb(${compensateDarkFilter(channels).join(' ')})`
        : token;
}

/**
 * The canvas draws cursors itself and needs a colour value, not a class: the
 * presence token of the member's slot, the one of the avatar ring (answer
 * 7-D6). In the dark theme the value is the one the canvas's filter turns back
 * into the token. Resolved once per slot and theme: cursors are drawn again on
 * every pointer message.
 */
export function presenceCursorColor(memberId: string): CursorColor {
    const slot = presenceSlot(memberId);
    const dark = document.documentElement.classList.contains('dark');
    const key = `${slot}:${dark}`;
    const known = cursorColors.get(key);

    if (known) {
        return known;
    }

    const styles = getComputedStyle(document.documentElement);
    const background = forCanvas(
        styles.getPropertyValue(`--skrum-presence-${slot}`).trim(),
        dark,
    );
    const stroke = forCanvas(
        styles.getPropertyValue(`--skrum-presence-${slot}-foreground`).trim(),
        dark,
    );
    const color = {
        background: background || 'currentColor',
        stroke: stroke || background || 'currentColor',
    };

    cursorColors.set(key, color);

    return color;
}
