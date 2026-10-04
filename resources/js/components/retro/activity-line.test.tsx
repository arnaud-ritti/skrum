import { describe, expect, it } from 'vitest';
import { ActivityLine } from '@/components/retro/activity-line';
import {
    ActivityContext,
    type RetroActivity,
} from '@/hooks/use-retro-activity';
import type { ActivityEntry, ActivityKind } from '@/lib/retro/activity';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const online = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'p1', name: 'Inès Bernard', avatarUrl: '/i.svg', isGuest: false },
    { id: 'p2', name: 'Malik Diallo', avatarUrl: '/m.svg', isGuest: false },
    { id: 'p3', name: 'Yuki Sato', avatarUrl: '/y.svg', isGuest: false },
    { id: 'p4', name: 'Guest Visitor', avatarUrl: '/g.svg', isGuest: true },
];

function entry(
    senderId: string,
    kind: ActivityKind,
    targetId: string,
): ActivityEntry {
    return { senderId, kind, targetId, expiresAt: Number.MAX_SAFE_INTEGER };
}

function renderLine(
    entries: ActivityEntry[],
    line: React.ReactElement,
    isAnonymous = false,
) {
    const activity: RetroActivity = {
        entries,
        writingCount: 0,
        announce: () => {},
        end: () => {},
    };
    const ctx = boardContext(retroSnapshot({ retro: { isAnonymous } }), {
        online,
    });

    renderInBoard(
        <ActivityContext value={activity}>{line}</ActivityContext>,
        ctx,
    );

    return document.querySelector('[data-slot="retro-activity"]');
}

describe('ActivityLine', () => {
    it('renders nothing without a live entry on its target', () => {
        expect(
            renderLine(
                [entry('p1', 'writing', 'other')],
                <ActivityLine kind="writing" targetId="col" />,
            ),
        ).toBeNull();
    });

    it('names one writer by first name in a polite status', () => {
        const line = renderLine(
            [entry('p1', 'writing', 'col')],
            <ActivityLine kind="writing" targetId="col" />,
        );

        expect(line?.textContent).toBe('Inès is writing a card…');
        expect(line?.getAttribute('role')).toBe('status');
        expect(line?.getAttribute('aria-live')).toBe('polite');
        expect(line?.getAttribute('data-kind')).toBe('writing');
    });

    it('names two writers, then the first and how many others', () => {
        expect(
            renderLine(
                [entry('p1', 'writing', 'col'), entry('p2', 'writing', 'col')],
                <ActivityLine kind="writing" targetId="col" />,
            )?.textContent,
        ).toBe('Inès and Malik are writing cards…');
    });

    it('says how many others write past two names', () => {
        expect(
            renderLine(
                [
                    entry('p1', 'writing', 'col'),
                    entry('p2', 'writing', 'col'),
                    entry('p3', 'writing', 'col'),
                ],
                <ActivityLine kind="writing" targetId="col" />,
            )?.textContent,
        ).toBe('Inès and 2 others are writing cards…');
    });

    it('says who moves one of the column cards', () => {
        expect(
            renderLine(
                [entry('p3', 'moving', 'card-b')],
                <ActivityLine kind="moving" targetIds={['card-a', 'card-b']} />,
            )?.textContent,
        ).toBe('Yuki is moving a card…');
    });

    it('keeps a guest name whole and says who takes notes', () => {
        expect(
            renderLine(
                [entry('p4', 'notes', 'lead')],
                <ActivityLine kind="notes" targetId="lead" />,
            )?.textContent,
        ).toBe('Guest Visitor is taking notes…');
    });

    it('says "Participant" on an anonymous retro, and never shows writing there', () => {
        expect(
            renderLine(
                [entry('p3', 'moving', 'card')],
                <ActivityLine kind="moving" targetId="card" />,
                true,
            )?.textContent,
        ).toBe('Participant is moving a card…');

        document.body.innerHTML = '';

        expect(
            renderLine(
                [entry('p1', 'writing', 'col')],
                <ActivityLine kind="writing" targetId="col" />,
                true,
            ),
        ).toBeNull();
    });

    it('counts the people moving cards on an anonymous retro instead of repeating "Participant"', () => {
        expect(
            renderLine(
                [entry('p1', 'moving', 'card'), entry('p2', 'moving', 'card')],
                <ActivityLine kind="moving" targetId="card" />,
                true,
            )?.textContent,
        ).toBe('2 participants are moving cards…');
    });

    it('colours the trema of an anonymous retro with no presence colour, which would name the person', () => {
        const line = renderLine(
            [entry('p3', 'moving', 'card')],
            <ActivityLine kind="moving" targetId="card" />,
            true,
        );

        expect(
            line?.querySelector('[class*="text-skrum-presence"]'),
        ).toBeNull();
    });
});
