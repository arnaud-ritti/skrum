import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GroupNameSuggestionsProvider } from '@/components/retro/board-group';
import {
    DiscussionProvider,
    PhaseDiscussing,
} from '@/components/retro/phase-discussing';
import { TopicTimer } from '@/components/retro/topic-timer';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const columns: BoardColumn[] = [
    {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
    },
];

function card(id: string, votes: number): BoardCard {
    return {
        id,
        columnId: 'start',
        parentCardId: null,
        position: votes,
        isMine: false,
        hidden: false,
        content: id,
        gif: null,
        author: null,
        groupName: null,
        discussedAt: null,
        votes,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
    };
}

type RetroOverrides = NonNullable<Parameters<typeof retroSnapshot>[0]>['retro'];

function stage(retro: RetroOverrides = {}) {
    return renderInBoard(
        <GroupNameSuggestionsProvider>
            <DiscussionProvider>
                <PhaseDiscussing hideMyCursor timer={<TopicTimer />} />
            </DiscussionProvider>
        </GroupNameSuggestionsProvider>,
        boardContext(
            retroSnapshot({
                columns,
                cards: [card('a', 3), card('b', 2)],
                retro: {
                    phase: 'discussing',
                    highlightedCardId: 'a',
                    timerEndsAt: new Date(Date.now() + 252_000).toISOString(),
                    ...retro,
                },
            }),
        ),
    );
}

const timer = (container: HTMLElement) =>
    container.querySelector(
        '[data-slot="retro-topic-timer"] [data-slot="timer"]',
    );

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

describe('TopicTimer', () => {
    it('draws the large timer of the retro between the two topic buttons', () => {
        const { container } = stage({ topicSeconds: 300 });

        expect(
            container.querySelector(
                '[data-slot="retro-topic-nav"] [data-slot="retro-topic-timer"]',
            ),
        ).toBeTruthy();
        expect(timer(container)?.getAttribute('data-size')).toBe('lg');
        expect(screen.getByRole('button', { name: '+2 min' })).toBeTruthy();
    });

    it('says "of 5:00 · this topic" on the shared topic only', () => {
        const { container } = stage({ topicSeconds: 300 });

        expect(screen.getByText('of 5:00 · this topic')).toBeTruthy();

        fireEvent.click(
            container.querySelector(
                '[data-test="retro-topics"] > li[data-topic-id="b"] button',
            ) as HTMLElement,
        );

        expect(screen.queryByText(/this topic/)).toBeNull();
        expect(timer(container)).toBeTruthy();
    });

    it('says nothing under the timer without a time per topic', () => {
        stage({ topicSeconds: null });

        expect(screen.queryByText(/this topic/)).toBeNull();
        expect(screen.getByRole('timer')).toBeTruthy();
    });

    it('draws the paused timer', () => {
        stage({ topicSeconds: 300, timerEndsAt: null, timerPausedSeconds: 75 });

        expect(screen.getByRole('timer').textContent).toContain('1:15');
        expect(screen.getByText('of 5:00 · this topic')).toBeTruthy();
    });
});
