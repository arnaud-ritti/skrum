import { afterEach, describe, expect, it, vi } from 'vitest';
import { toParticipants } from '@/components/session/session-presence';
import {
    PresenceSlots,
    compensateDarkFilter,
    forgetPresenceCursorColors,
    presenceCursorColor,
    presenceFor,
    presenceSlot,
} from '@/lib/whiteboard/presence-slot';

const fran = {
    id: '0199f3a2-7c1e-7a10-9d5e-3b1f0c2d4e5f',
    name: 'Fran Facilitator',
    avatarUrl: '/avatars/f.svg',
    isGuest: false,
};
const gia = {
    id: '0199f3a2-7c1e-7a10-9d5e-aaaaaaaaaaaa',
    name: 'Guest Gia',
    avatarUrl: '/avatars/g.svg',
    isGuest: true,
};

afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.remove('dark');
    forgetPresenceCursorColors();
    vi.restoreAllMocks();
});

/** What the canvas does to a colour in the dark theme: invert(93%) then hue-rotate(180deg). */
function throughDarkFilter([red, green, blue]: number[]): number[] {
    const [r, g, b] = [red, green, blue].map(
        (channel) => 0.93 - 0.86 * (channel / 255),
    );

    return [
        -0.574 * r + 1.43 * g + 0.144 * b,
        0.426 * r + 0.43 * g + 0.144 * b,
        0.426 * r + 1.43 * g - 0.856 * b,
    ].map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255));
}

describe('presenceSlot', () => {
    it('gives the same member the same slot every time', () => {
        expect(presenceSlot(fran.id)).toBe(presenceSlot(fran.id));
    });

    it('stays between 1 and the number of presence colours', () => {
        const ids = Array.from(
            { length: 200 },
            (_, index) => `member-${index}`,
        );
        const slots = ids.map(presenceSlot);

        expect(Math.min(...slots)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...slots)).toBeLessThanOrEqual(PresenceSlots);
        expect(new Set(slots).size).toBe(PresenceSlots);
    });

    it('gives an empty id the first slot', () => {
        expect(presenceSlot('')).toBe(1);
    });
});

describe('presenceCursorColor', () => {
    it('reads the presence token of the member from the document', () => {
        const slot = presenceSlot(fran.id);

        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}`,
            'oklch(0.7 0.1 20)',
        );
        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}-foreground`,
            'oklch(0.2 0.01 50)',
        );

        expect(presenceCursorColor(fran.id)).toEqual({
            background: 'oklch(0.7 0.1 20)',
            stroke: 'oklch(0.2 0.01 50)',
        });
    });

    it('resolves the token once per member colour, until the theme changes', () => {
        const slot = presenceSlot(fran.id);
        const read = vi.spyOn(window, 'getComputedStyle');

        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}`,
            'oklch(0.7 0.1 20)',
        );

        presenceCursorColor(fran.id);
        presenceCursorColor(fran.id);

        expect(read).toHaveBeenCalledTimes(1);

        forgetPresenceCursorColors();
        presenceCursorColor(fran.id);

        expect(read).toHaveBeenCalledTimes(2);
    });

    it('gives the dark canvas the colour its filter turns back into the token', () => {
        const slot = presenceSlot(fran.id);
        const painted: Record<string, number[]> = {
            'oklch(0.748 0.135 250)': [118, 178, 250],
            'oklch(0.2 0.015 50)': [26, 21, 17],
        };
        let fill = '';

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            set fillStyle(value: string) {
                fill = value;
            },
            fillRect: () => {},
            getImageData: () => ({ data: [...painted[fill], 255] }),
        } as never);

        document.documentElement.classList.add('dark');
        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}`,
            'oklch(0.748 0.135 250)',
        );
        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}-foreground`,
            'oklch(0.2 0.015 50)',
        );

        const { background, stroke } = presenceCursorColor(fran.id);
        const channels = (color: string) =>
            color.match(/\d+/g)?.map(Number) ?? [];

        expect(background).toMatch(/^rgb\(\d+ \d+ \d+\)$/);

        for (const [index, channel] of throughDarkFilter(
            channels(background),
        ).entries()) {
            expect(
                Math.abs(channel - painted['oklch(0.748 0.135 250)'][index]),
            ).toBeLessThanOrEqual(2);
        }

        for (const [index, channel] of throughDarkFilter(
            channels(stroke),
        ).entries()) {
            expect(
                Math.abs(channel - painted['oklch(0.2 0.015 50)'][index]),
            ).toBeLessThanOrEqual(8);
        }
    });

    it('keeps the token as it is in the dark theme when the browser cannot paint it', () => {
        const slot = presenceSlot(fran.id);

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            null,
        );
        document.documentElement.classList.add('dark');
        document.documentElement.style.setProperty(
            `--skrum-presence-${slot}`,
            'oklch(0.748 0.135 250)',
        );

        expect(presenceCursorColor(fran.id).background).toBe(
            'oklch(0.748 0.135 250)',
        );
    });

    it('still gives a colour when the token is missing', () => {
        expect(presenceCursorColor(fran.id)).toEqual({
            background: 'currentColor',
            stroke: 'currentColor',
        });
    });
});

describe('compensateDarkFilter', () => {
    it.each([[[118, 178, 250]], [[128, 128, 128]], [[60, 90, 70]]])(
        'is undone by the filter for %j',
        (color) => {
            const shown = throughDarkFilter(compensateDarkFilter(color));

            for (const [index, channel] of shown.entries()) {
                expect(Math.abs(channel - color[index])).toBeLessThanOrEqual(2);
            }
        },
    );

    it("stays a colour the canvas can draw for a token out of the filter's reach", () => {
        for (const channel of compensateDarkFilter([245, 128, 40])) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(255);
        }
    });
});

describe('participants of a whiteboard', () => {
    it('maps the facilitator, a guest, the viewer and the presence slot', () => {
        const participants = toParticipants(
            [fran, gia],
            gia.id,
            fran.id,
            presenceFor,
        );

        expect(participants).toEqual([
            {
                id: fran.id,
                name: 'Fran Facilitator',
                avatarUrl: '/avatars/f.svg',
                role: 'facilitator',
                status: 'online',
                isMe: false,
                presence: presenceSlot(fran.id),
            },
            {
                id: gia.id,
                name: 'Guest Gia',
                avatarUrl: '/avatars/g.svg',
                role: 'guest',
                status: 'online',
                isMe: true,
                presence: presenceSlot(gia.id),
            },
        ]);
    });
});
