import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscussionProvider } from '@/components/retro/phase-discussing';
import {
    DiscussionEstimate,
    DiscussionPace,
    TopicMeta,
    TopicTime,
} from '@/components/retro/topic-meta';
import { topicsFrom } from '@/lib/retro/topics';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { actionItemFixture } from '@/test/action-items';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const now = new Date('2026-10-21T10:00:00Z');

const columns: BoardColumn[] = [
    {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
    },
];

function card(
    id: string,
    votes: number,
    discussedAt: string | null = null,
): BoardCard {
    return {
        id,
        columnId: 'start',
        parentCardId: null,
        position: 0,
        isMine: false,
        hidden: false,
        content: id,
        gif: null,
        author: null,
        groupName: null,
        discussedAt,
        votes,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
    };
}

type Overrides = Parameters<typeof retroSnapshot>[0];

function board({ retro, ...rest }: Overrides = {}) {
    return retroSnapshot({
        columns,
        cards: [
            card('a', 3, '2026-10-21T09:50:00Z'),
            card('b', 2),
            card('c', 1),
        ],
        actionItems: [],
        serverTime: now.toISOString(),
        ...rest,
        retro: { phase: 'discussing', highlightedCardId: 'b', ...retro },
    });
}

function metaOf(snapshot: ReturnType<typeof board>, id: string) {
    const topic = topicsFrom(snapshot).find((candidate) => candidate.id === id);

    if (!topic) {
        throw new Error(`No topic ${id}`);
    }

    return renderInBoard(
        <DiscussionProvider>
            <TopicMeta topic={topic} />
        </DiscussionProvider>,
        boardContext(snapshot),
    );
}

const state = (container: HTMLElement) =>
    container
        .querySelector('[data-slot="retro-topic-meta"]')
        ?.getAttribute('data-state');

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('TopicMeta', () => {
    it('shows the time left on the shared topic, and counts it down', () => {
        const { container } = metaOf(
            board({
                retro: {
                    topicSeconds: 300,
                    timerEndsAt: new Date(
                        now.getTime() + 252_000,
                    ).toISOString(),
                },
            }),
            'b',
        );

        expect(state(container)).toBe('now');
        expect(container.textContent).toBe('Now · 04:12 left');

        act(() => {
            vi.advanceTimersByTime(2_000);
        });

        expect(container.textContent).toBe('Now · 04:10 left');
    });

    it('shows the paused seconds on the shared topic', () => {
        const { container } = metaOf(
            board({
                retro: {
                    topicSeconds: 300,
                    timerEndsAt: null,
                    timerPausedSeconds: 75,
                },
            }),
            'b',
        );

        expect(container.textContent).toBe('Now · 01:15 left');
    });

    it('says "Now" alone on the shared topic without a time per topic', () => {
        const { container } = metaOf(
            board({
                retro: {
                    topicSeconds: null,
                    timerEndsAt: new Date(now.getTime() + 60_000).toISOString(),
                },
            }),
            'b',
        );

        expect(state(container)).toBe('now');
        expect(container.textContent).toBe('Now');
    });

    it('marks a discussed topic with its action items, singular and plural', () => {
        const none = metaOf(board(), 'a');

        expect(state(none.container)).toBe('discussed');
        expect(none.container.textContent).toBe('Discussed');
        none.unmount();

        const one = metaOf(
            board({ actionItems: [actionItemFixture({ cardId: 'a' })] }),
            'a',
        );

        expect(one.container.textContent).toBe('Discussed · 1 action');
        one.unmount();

        const two = metaOf(
            board({
                actionItems: [
                    actionItemFixture({ id: 'i1', cardId: 'a' }),
                    actionItemFixture({ id: 'i2', cardId: 'a' }),
                    actionItemFixture({ id: 'i3', cardId: 'c' }),
                ],
            }),
            'a',
        );

        expect(two.container.textContent).toBe('Discussed · 2 actions');
    });

    it('counts the action items of another topic, and draws nothing without one', () => {
        const none = metaOf(board(), 'c');

        expect(none.container.textContent).toBe('');
        none.unmount();

        const one = metaOf(
            board({ actionItems: [actionItemFixture({ cardId: 'c' })] }),
            'c',
        );

        expect(state(one.container)).toBe('idle');
        expect(one.container.textContent).toBe('1 action');
        one.unmount();

        const two = metaOf(
            board({
                actionItems: [
                    actionItemFixture({ id: 'i1', cardId: 'c' }),
                    actionItemFixture({ id: 'i2', cardId: 'c' }),
                ],
            }),
            'c',
        );

        expect(two.container.textContent).toBe('2 actions');
    });
});

describe('the estimate of the discussion', () => {
    function footer(snapshot: ReturnType<typeof board>) {
        return renderInBoard(
            <DiscussionProvider>
                <p data-test="estimate">
                    <DiscussionEstimate />
                </p>
                <p data-test="pace">
                    <DiscussionPace />
                </p>
                <p data-test="time">
                    <TopicTime />
                </p>
            </DiscussionProvider>,
            boardContext(snapshot),
        );
    }

    const text = (name: string) =>
        document.querySelector(`[data-test="${name}"]`)?.textContent;

    it('adds what is left of the shared topic to the topics not yet discussed', () => {
        footer(
            board({
                retro: {
                    topicSeconds: 300,
                    timerEndsAt: new Date(
                        now.getTime() + 252_000,
                    ).toISOString(),
                },
                actionItems: [
                    actionItemFixture({ id: 'i1' }),
                    actionItemFixture({ id: 'i2' }),
                    actionItemFixture({ id: 'i3' }),
                ],
            }),
        );

        expect(text('estimate')).toBe('~ 10 min left');
        expect(text('pace')).toBe('5 min per topic · 3 actions so far');
        expect(text('time')).toBe('5 min');
    });

    it('says less than a minute at the end', () => {
        footer(
            board({
                cards: [card('a', 3, '2026-10-21T09:50:00Z'), card('b', 2)],
                retro: {
                    topicSeconds: 300,
                    timerEndsAt: new Date(now.getTime() + 30_000).toISOString(),
                },
                actionItems: [actionItemFixture()],
            }),
        );

        expect(text('estimate')).toBe('< 1 min left');
        expect(text('pace')).toBe('5 min per topic · 1 action so far');
    });

    it('shows nothing of the time without a time per topic', () => {
        footer(board({ retro: { topicSeconds: null } }));

        expect(text('estimate')).toBe('');
        expect(text('pace')).toBe('0 actions so far');
        expect(text('time')).toBe('');
        expect(screen.queryByText(/min/)).toBeNull();
    });
});
