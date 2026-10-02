import { afterEach, describe, expect, it } from 'vitest';
import { toParticipants } from '@/components/session/session-presence';
import {
    PresenceSlots,
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
});

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

    it('still gives a colour when the token is missing', () => {
        expect(presenceCursorColor(fran.id)).toEqual({
            background: 'currentColor',
            stroke: 'currentColor',
        });
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
