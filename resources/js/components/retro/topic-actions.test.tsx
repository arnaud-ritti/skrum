import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardContextValue } from '@/components/retro/board-context';
import { PhaseActions } from '@/components/retro/phase-actions';
import {
    DiscussionProvider,
    useDiscussion,
} from '@/components/retro/phase-discussing';
import { ActionsCreated } from '@/components/retro/results/action-items';
import {
    ItemTopic,
    LinkedActionCount,
    QuickAddLink,
    TopicActions,
} from '@/components/retro/topic-actions';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { actionItemFixture } from '@/test/action-items';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

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

function card(overrides: Partial<BoardCard> = {}): BoardCard {
    return {
        id: 'c1',
        columnId: 'start',
        parentCardId: null,
        position: 0,
        isMine: false,
        hidden: false,
        content: 'Slow CI',
        gif: null,
        author: null,
        groupName: null,
        discussedAt: null,
        votes: 0,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
        ...overrides,
    };
}

const cards = [
    card({ id: 'slow', content: 'Slow CI', votes: 3 }),
    card({
        id: 'scope',
        content: 'Scope changes mid-sprint',
        votes: 2,
        position: 1,
    }),
];

const items = [
    actionItemFixture({ id: 'on-slow', content: 'Cache', cardId: 'slow' }),
    actionItemFixture({ id: 'on-scope', content: 'Ask PO', cardId: 'scope' }),
    actionItemFixture({ id: 'loose', content: 'Tidy', cardId: null }),
];

type Overrides = Parameters<typeof retroSnapshot>[0];

function NextTopic() {
    const { step } = useDiscussion();

    return (
        <button type="button" onClick={() => step(1)}>
            Next
        </button>
    );
}

function render(
    node: React.ReactNode,
    { retro, ...rest }: Overrides = {},
    ctx: Partial<BoardContextValue> = {},
) {
    return renderInBoard(
        <DiscussionProvider>{node}</DiscussionProvider>,
        boardContext(
            retroSnapshot({
                columns,
                cards,
                actionItems: items,
                ...rest,
                retro: { phase: 'discussing', ...retro },
            }),
            ctx,
        ),
    );
}

const posts = () =>
    retroRequest.mock.calls.filter(([route]) => route.method === 'post');

function create(title: string): void {
    const form = screen.getByRole('form', { name: 'New action item' });
    const field = within(form).getByLabelText('Add an action item…');

    fireEvent.change(field, { target: { value: title } });
    fireEvent.submit(form);
}

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ actionItem: actionItemFixture() });
});

describe('TopicActions', () => {
    it('lists the actions of the topic in front of the viewer, and follows it as it changes', () => {
        const { container } = render(
            <>
                <TopicActions />
                <NextTopic />
            </>,
        );

        expect(
            screen.getByRole('heading', { name: 'Topic actions' }),
        ).toBeTruthy();
        expect(screen.getByText('Linked to #1 · Slow CI')).toBeTruthy();
        expect(container.querySelector('#action-item-on-slow')).not.toBeNull();
        expect(container.querySelector('#action-item-on-scope')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(
            screen.getByText('Linked to #2 · Scope changes mid-sprint'),
        ).toBeTruthy();
        expect(container.querySelector('#action-item-on-scope')).not.toBeNull();
        expect(container.querySelector('#action-item-on-slow')).toBeNull();
    });

    it('creates an item linked to the viewer’s topic', async () => {
        render(<TopicActions />, { retro: { highlightedCardId: 'scope' } });

        create('One in, one out');

        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0][1]).toMatchObject({ card_id: 'scope' });
    });

    it('creates an item without a topic once the link is removed', async () => {
        render(<TopicActions />);

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Remove the link to the topic',
            }),
        );
        create('Tidy the backlog');

        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0][1]).not.toHaveProperty('card_id');
    });

    it('folds every other item of the retro under "Other action items (n)", with its topic', () => {
        const { container } = render(<TopicActions />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Other action items (2)' }),
        );

        const scoped = container.querySelector(
            '#action-item-on-scope',
        ) as HTMLElement;

        expect(scoped).not.toBeNull();
        expect(
            within(scoped).getByText('Scope changes mid-sprint'),
        ).toBeTruthy();
        expect(container.querySelector('#action-item-loose')).not.toBeNull();
    });

    it('is the plain list of action items when there is no topic', () => {
        render(<TopicActions />, { cards: [] });

        expect(
            screen.getByRole('heading', { name: 'Action items' }),
        ).toBeTruthy();
        expect(screen.queryByText(/Linked to/)).toBeNull();
        expect(
            screen.queryByRole('button', { name: /Other action items/ }),
        ).toBeNull();
    });
});

describe('the Actions phase', () => {
    function actions(overrides: Overrides = {}) {
        return render(
            <PhaseActions
                hideMyCursor
                linkedTo={(topic) => <QuickAddLink topic={topic} />}
                itemTopic={(item) => <ItemTopic item={item} />}
                topicMeta={(topic) => <LinkedActionCount topic={topic} />}
            />,
            {
                ...overrides,
                retro: { phase: 'actions', ...overrides.retro },
            },
        );
    }

    it('links the quick add to the shared topic', async () => {
        actions({ retro: { highlightedCardId: 'slow' } });

        expect(
            screen.getByText('Quick add · linked to “Slow CI”'),
        ).toBeTruthy();

        create('Cache the dependencies');

        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0][1]).toMatchObject({ card_id: 'slow' });
    });

    it('links nothing without a shared topic', async () => {
        actions();

        expect(screen.getByText('Quick add')).toBeTruthy();

        create('Cache the dependencies');

        await waitFor(() => expect(posts()).toHaveLength(1));
        expect(posts()[0][1]).not.toHaveProperty('card_id');
    });

    it('shows the topic of each item in its meta line, and the linked actions of each topic', () => {
        const { container } = actions({
            actionItems: [
                ...items,
                actionItemFixture({ id: 'more', cardId: 'slow' }),
            ],
        });
        const slowItem = container.querySelector(
            '#action-item-on-slow',
        ) as HTMLElement;
        const topics = container.querySelectorAll(
            '[data-slot="retro-actions-topic"]',
        );

        expect(within(slowItem).getByText('Slow CI')).toBeTruthy();
        expect(
            container.querySelector(
                '#action-item-loose [data-slot="retro-item-topic"]',
            ),
        ).toBeNull();
        expect(
            within(topics[0] as HTMLElement).getByText('2 linked actions'),
        ).toBeTruthy();
        expect(
            within(topics[1] as HTMLElement).getByText('1 linked action'),
        ).toBeTruthy();
    });
});

describe('ActionsCreated', () => {
    it('names the topic of each item', () => {
        const { container } = renderInBoard(
            <ActionsCreated />,
            boardContext(
                retroSnapshot({
                    columns,
                    cards,
                    actionItems: items,
                    retro: { phase: 'completed' },
                }),
            ),
        );

        expect(
            within(
                container.querySelector('#action-item-on-scope') as HTMLElement,
            ).getByText('Scope changes mid-sprint'),
        ).toBeTruthy();
    });
});
