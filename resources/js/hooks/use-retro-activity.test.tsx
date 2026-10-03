import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BoardProvider,
    type BoardContextValue,
} from '@/components/retro/board-context';
import { useRetroActivity } from '@/hooks/use-retro-activity';
import type { RetroPhase } from '@/lib/retro/types';
import { boardContext, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function fakeChannel() {
    const listeners = new Map<string, Listener>();
    const whispers: { event: string; data: unknown }[] = [];

    return {
        whispers,
        channel: {
            whisper: (event: string, data: unknown) => {
                whispers.push({ event, data });
            },
            listen: (event: string, callback: Listener) => {
                listeners.set(event, callback);
            },
            stopListening: (event: string) => {
                listeners.delete(event);
            },
        },
        emit: (data: unknown, senderId: string) => {
            act(() => {
                listeners.get('.client-activity')?.(data, {
                    user_id: senderId,
                });
            });
        },
    };
}

function setup({
    phase = 'writing',
    isAnonymous = false,
}: { phase?: RetroPhase; isAnonymous?: boolean } = {}) {
    const fake = fakeChannel();
    const countListeners = new Set<(count: number) => void>();
    const contextFor = (nextPhase: RetroPhase): BoardContextValue =>
        boardContext(
            retroSnapshot({ retro: { phase: nextPhase, isAnonymous } }),
            {
                presence: fake.channel,
                subscribeWritingCount: (listener) => {
                    countListeners.add(listener);

                    return () => countListeners.delete(listener);
                },
            },
        );
    let ctx = contextFor(phase);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <BoardProvider value={ctx}>{children}</BoardProvider>
    );
    const hook = renderHook(() => useRetroActivity(), { wrapper });

    return {
        ...fake,
        hook,
        setPhase: (next: RetroPhase) => {
            ctx = contextFor(next);
            hook.rerender();
        },
        broadcastCount: (count: number) => {
            act(() => {
                for (const listener of countListeners) {
                    listener(count);
                }
            });
        },
    };
}

const activityWhispers = (whispers: { event: string; data: unknown }[]) =>
    whispers.filter((whisper) => whisper.event === 'activity');

beforeEach(() => {
    vi.useFakeTimers();
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useRetroActivity', () => {
    it('shows a message from an online member and forgets it five seconds later', () => {
        const { emit, hook } = setup();

        emit({ kind: 'writing', targetId: 'col', active: true }, 'bob');

        expect(hook.result.current.entries).toEqual([
            expect.objectContaining({
                senderId: 'bob',
                kind: 'writing',
                targetId: 'col',
            }),
        ]);

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(hook.result.current.entries).toEqual([]);
    });

    it('ignores the viewer and members who are not online', () => {
        const { emit, hook } = setup();

        emit({ kind: 'writing', targetId: 'col', active: true }, 'me');
        emit({ kind: 'writing', targetId: 'col', active: true }, 'zoe');

        expect(hook.result.current.entries).toEqual([]);
    });

    it('ignores a writing message on an anonymous retro', () => {
        const { emit, hook } = setup({ isAnonymous: true });

        emit({ kind: 'writing', targetId: 'col', active: true }, 'bob');
        emit({ kind: 'moving', targetId: 'card', active: true }, 'bob');

        expect(hook.result.current.entries.map((entry) => entry.kind)).toEqual([
            'moving',
        ]);
    });

    it('sends an ongoing activity once every two seconds at most, and its end', () => {
        const { whispers, hook } = setup();

        act(() => {
            hook.result.current.announce('writing', 'col');
            hook.result.current.announce('writing', 'col');
        });

        expect(activityWhispers(whispers)).toHaveLength(1);

        act(() => {
            vi.advanceTimersByTime(2000);
            hook.result.current.announce('writing', 'col');
            hook.result.current.end('writing', 'col');
            hook.result.current.end('writing', 'col');
        });

        expect(activityWhispers(whispers).map((w) => w.data)).toEqual([
            { kind: 'writing', targetId: 'col', active: true },
            { kind: 'writing', targetId: 'col', active: true },
            { kind: 'writing', targetId: 'col', active: false },
        ]);
    });

    it('never whispers writing on an anonymous retro: a bodiless heartbeat every three seconds, then one stop', async () => {
        const { whispers, hook } = setup({ isAnonymous: true });

        await act(async () => {
            hook.result.current.announce('writing', 'col');
            hook.result.current.announce('writing', 'col');
        });

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(retroRequest).toHaveBeenLastCalledWith(
            expect.objectContaining({
                method: 'put',
                url: '/retros/retro-1/writing',
            }),
        );

        await act(async () => {
            vi.advanceTimersByTime(3000);
            hook.result.current.announce('writing', 'col');
        });

        expect(retroRequest).toHaveBeenCalledTimes(2);

        await act(async () => {
            hook.result.current.end('writing', 'col');
            hook.result.current.end('writing', 'col');
        });

        expect(retroRequest).toHaveBeenCalledTimes(3);
        expect(retroRequest).toHaveBeenLastCalledWith(
            expect.objectContaining({ method: 'delete' }),
        );
        expect(
            whispers.filter(
                (whisper) =>
                    (whisper.data as { kind?: string }).kind === 'writing',
            ),
        ).toEqual([]);
    });

    it('counts the others writing on an anonymous retro, and drops a stale count', async () => {
        const { hook, broadcastCount } = setup({ isAnonymous: true });

        await act(async () => {
            hook.result.current.announce('writing', 'col');
        });
        broadcastCount(3);

        expect(hook.result.current.writingCount).toBe(2);

        act(() => {
            vi.advanceTimersByTime(8000);
        });

        expect(hook.result.current.writingCount).toBe(0);
    });

    it('takes no count on a named retro', () => {
        const { hook, broadcastCount } = setup();

        broadcastCount(3);

        expect(hook.result.current.writingCount).toBe(0);
    });

    it('ends what it announced when the phase changes', () => {
        const { whispers, hook, setPhase } = setup({ phase: 'grouping' });

        act(() => {
            hook.result.current.announce('moving', 'card');
        });
        setPhase('voting');

        expect(activityWhispers(whispers).map((w) => w.data)).toEqual([
            { kind: 'moving', targetId: 'card', active: true },
            { kind: 'moving', targetId: 'card', active: false },
        ]);
    });

    it('sends nothing its phase does not show', () => {
        const { whispers, hook } = setup({ phase: 'voting' });

        act(() => {
            hook.result.current.announce('moving', 'card');
        });

        expect(activityWhispers(whispers)).toEqual([]);
    });
});
