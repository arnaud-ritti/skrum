import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRetroBoard } from '@/hooks/use-retro-board';
import type { RetroEvent } from '@/hooks/use-retro-channel';
import { retroSnapshot } from '@/test/retro-board';

const mocks = vi.hoisted(() => ({
    onEvent: null as ((event: RetroEvent) => void) | null,
    request: vi.fn(),
}));

vi.mock('@/hooks/use-retro-channel', () => ({
    useRetroChannel: (
        _retroId: string,
        _participantId: string,
        _enabled: boolean,
        _membersOnly: boolean,
        handlers: { onEvent: (event: RetroEvent) => void },
    ) => {
        mocks.onEvent = handlers.onEvent;

        return {
            online: [],
            connected: true,
            reconnecting: false,
            presence: null,
        };
    },
}));

vi.mock('@/hooks/use-trans', () => ({
    useTrans: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function receive(name: RetroEvent['name'], payload: Record<string, unknown>) {
    act(() => mocks.onEvent?.({ name, payload }));
}

describe('useRetroBoard facilitation events', () => {
    it('applies the paused timer, the finished voters, the discussed mark and a saved note', () => {
        const { result } = renderHook(() =>
            useRetroBoard(
                retroSnapshot({
                    cards: [
                        { id: 'c', comments: [], discussedAt: null },
                    ] as unknown as ReturnType<typeof retroSnapshot>['cards'],
                }),
            ),
        );

        receive('timer.changed', {
            timerEndsAt: null,
            timerPausedSeconds: 42,
            topicSeconds: 300,
        });
        receive('voting.finished', { finishedIds: ['p1'] });
        receive('topic.discussed', {
            cardId: 'c',
            discussedAt: '2026-10-21T10:01:00Z',
        });
        receive('topic.note.saved', {
            note: { cardId: 'c', body: 'Notes', version: 1, updatedAt: null },
        });

        expect(result.current.board.retro).toMatchObject({
            timerEndsAt: null,
            timerPausedSeconds: 42,
            topicSeconds: 300,
        });
        expect(result.current.board.voting.finishedIds).toEqual(['p1']);
        expect(result.current.board.cards[0].discussedAt).toBe(
            '2026-10-21T10:01:00Z',
        );
        expect(result.current.board.topicNotes).toEqual([
            { cardId: 'c', body: 'Notes', version: 1, updatedAt: null },
        ]);
    });

    it('calls the nudge and writing count listeners while they are subscribed', () => {
        const { result } = renderHook(() => useRetroBoard(retroSnapshot()));
        const nudged = vi.fn();
        const counted = vi.fn();
        const stopNudges = result.current.subscribeRotiNudges(nudged);
        const stopCounts = result.current.subscribeWritingCount(counted);

        receive('roti.nudged', {});
        receive('writing.count', { count: 2 });

        stopNudges();
        stopCounts();

        receive('roti.nudged', {});
        receive('writing.count', { count: 0 });

        expect(nudged).toHaveBeenCalledTimes(1);
        expect(counted).toHaveBeenCalledTimes(1);
        expect(counted).toHaveBeenCalledWith(2);
    });

    it('reads the board again when the ROTI is revealed', () => {
        mocks.request.mockReset().mockReturnValue(new Promise(() => {}));
        renderHook(() => useRetroBoard(retroSnapshot()));

        receive('roti.revealed', {});

        expect(mocks.request).toHaveBeenCalledTimes(1);
    });
});
