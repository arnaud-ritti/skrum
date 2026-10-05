import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardContextValue } from '@/components/retro/board-context';
import { FacilitatorDock } from '@/components/retro/facilitator-dock';
import { PhaseActions, topicExcerpt } from '@/components/retro/phase-actions';
import {
    DiscussionProvider,
    PresentationOverlay,
} from '@/components/retro/phase-discussing';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { actionItemFixture } from '@/test/action-items';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

const phone = vi.hoisted(() => ({ on: false }));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => phone.on,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

vi.mock('sonner', async (importOriginal) => ({
    ...(await importOriginal<typeof import('sonner')>()),
    toast: { success: vi.fn(), error: vi.fn() },
}));

const columns: BoardColumn[] = [
    {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
    },
    {
        id: 'stop',
        title: 'Stop',
        description: null,
        color: 'coral',
        position: 1,
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
        author: { id: 'bob', name: 'Bob Stone' },
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
    card({ id: 'flaky', content: 'Flaky tests', votes: 1 }),
    card({ id: 'slow', content: 'Slow CI', votes: 3, position: 1 }),
    card({
        id: 'scope',
        columnId: 'stop',
        groupName: 'Scope changes',
        content: 'Stories added on Wednesday',
        votes: 2,
    }),
    card({
        id: 'scope-2',
        columnId: 'stop',
        parentCardId: 'scope',
        content: 'The PO did not know',
    }),
];

type Overrides = Parameters<typeof retroSnapshot>[0];

function actions(
    { retro, ...rest }: Overrides = {},
    ctx: Partial<BoardContextValue> = {},
) {
    return renderInBoard(
        <DiscussionProvider>
            <PhaseActions hideMyCursor />
            <FacilitatorDock />
            <PresentationOverlay />
        </DiscussionProvider>,
        boardContext(
            retroSnapshot({
                columns,
                cards,
                ...rest,
                retro: { phase: 'actions', ...retro },
            }),
            ctx,
        ),
    );
}

const topicIds = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-test="retro-topics"] > li')].map(
        (row) => row.getAttribute('data-topic-id'),
    );

const focusedTopic = (container: HTMLElement) =>
    container
        .querySelector('[data-test="retro-topics"] > li[aria-current="true"]')
        ?.getAttribute('data-topic-id') ?? null;

const highlightCalls = () =>
    retroRequest.mock.calls.filter(([route]) =>
        String(route.url).endsWith('/highlight'),
    );

const callsTo = (method: string) =>
    retroRequest.mock.calls.filter(([route]) => route.method === method);

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    phone.on = false;
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
    vi.mocked(toast.success).mockReset();
});

describe('topicExcerpt', () => {
    it('is the first card of a named group, and nothing for a card alone or a group without a name', () => {
        expect(topicExcerpt({ leadCardId: 'scope' }, cards)).toBe(
            'Stories added on Wednesday',
        );
        expect(topicExcerpt({ leadCardId: 'slow' }, cards)).toBeNull();
        expect(
            topicExcerpt({ leadCardId: 'g' }, [
                card({ id: 'g', groupName: '  ', content: 'Lead' }),
            ]),
        ).toBeNull();
        expect(topicExcerpt({ leadCardId: 'gone' }, cards)).toBeNull();
    });
});

describe('PhaseActions', () => {
    it('lists the most voted topics in an ordered list, with rank, votes and the excerpt of a group', () => {
        const { container } = actions();
        const list = container.querySelector(
            '[data-test="retro-topics"]',
        ) as HTMLElement;

        expect(screen.getByText('Most voted topics')).toBeTruthy();
        expect(screen.getByText('Sorted by votes')).toBeTruthy();
        expect(list.tagName).toBe('OL');
        expect(topicIds(container)).toEqual(['slow', 'scope', 'flaky']);
        expect(list.children[0].textContent).toContain('#1');
        expect(list.children[0].textContent).toContain('Slow CI');
        expect(list.children[0].textContent).toContain('3 votes');
        expect(list.children[1].textContent).toContain('Scope changes');
        expect(list.children[1].textContent).toContain(
            'Stories added on Wednesday',
        );
    });

    it('has no card of the board on screen', () => {
        const { container } = actions();

        expect(container.querySelector('[data-slot="retro-card"]')).toBeNull();
        expect(container.querySelector('#card-slow')).toBeNull();
    });

    it('marks the highlighted card as the topic in discussion, for a grouped card too', () => {
        const { container } = actions({
            retro: { highlightedCardId: 'scope-2' },
        });
        const focused = container.querySelector(
            '[data-test="retro-topics"] > li[aria-current="true"]',
        ) as HTMLElement;

        expect(focusedTopic(container)).toBe('scope');
        expect(focused.textContent).toContain('In discussion');
        expect(
            container.querySelectorAll(
                '[data-test="retro-topics"] [data-shared]',
            ),
        ).toHaveLength(1);
    });

    it('has no topic in discussion until the facilitator picks one', () => {
        const { container } = actions();

        expect(focusedTopic(container)).toBeNull();
        expect(screen.queryByText('In discussion')).toBeNull();
    });

    it('never opens the presentation overlay, even while everyone follows', () => {
        actions({
            retro: { highlightedCardId: 'slow', presentationMode: true },
        });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('lets the facilitator put a topic in discussion for everyone with a press', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });

        const { container, ctx } = actions();

        fireEvent.click(
            within(
                container.querySelector(
                    '[data-topic-id="scope"]',
                ) as HTMLElement,
            ).getByRole('button'),
        );

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'scope' });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'highlight.set',
            cardId: 'scope',
        });
    });

    it('gives a participant topics that are not controls', () => {
        const { container } = actions({
            viewer: { isFacilitator: false, participantId: 'bob' },
        });

        expect(
            container.querySelectorAll('[data-test="retro-topics"] button'),
        ).toHaveLength(0);
        expect(topicIds(container)).toEqual(['slow', 'scope', 'flaky']);

        const scope = container.querySelector(
            '[data-test="retro-topics"] > li[data-topic-id="scope"]',
        ) as HTMLElement;

        fireEvent.click(scope);
        fireEvent.keyDown(scope, { key: 'f' });

        expect(highlightCalls()).toHaveLength(0);
    });

    it('says so when the retro has no card, and still takes action items', () => {
        const { container } = actions({ cards: [] });

        expect(screen.getByText('No topics to discuss.')).toBeTruthy();
        expect(
            container.querySelector('[data-test="retro-topics"]'),
        ).toBeNull();
        expect(screen.getByLabelText('Add an action item…')).toBeTruthy();
    });

    it('shows the actions card: its title with the count, what it is for, the quick form always open and the suggestions', () => {
        const { container } = actions({
            actionItems: [actionItemFixture()],
            features: { llm: true, llmProvider: 'anthropic' },
            insights: {
                themes: [{ id: 't1', name: 'Tooling', cardIds: ['slow'] }],
                suggestedActions: [],
            },
        });
        const panel = container.querySelector(
            '[data-test="retro-action-items-panel"]',
        ) as HTMLElement;

        expect(panel.getAttribute('data-variant')).toBe('phase');
        expect(
            within(panel).getByRole('heading', { name: /^Retro actions\s*1$/ }),
        ).toBeTruthy();
        expect(panel.textContent).toContain(
            'Give each action an owner and a due date.',
        );
        expect(panel.textContent).toContain('Quick add');
        expect(
            within(panel).queryByRole('button', { name: 'Create an action' }),
        ).toBeNull();
        expect(
            within(panel).queryByRole('button', { name: 'Cancel' }),
        ).toBeNull();
        expect(panel.querySelector('#action-item-item-1')).not.toBeNull();
        expect(
            screen.getByRole('complementary', { name: 'Suggestions' }),
        ).toBeTruthy();

        const form = panel.querySelector('form') as HTMLElement;
        const list = panel.querySelector('[role="list"]') as HTMLElement;

        expect(
            form.compareDocumentPosition(list) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('says "Action created" with the owner and an Undo that deletes the item without asking', async () => {
        const created = actionItemFixture({
            id: 'new',
            content: 'Rotate the on-call',
            assignee: {
                id: 'user-2',
                name: 'Bob Stone',
                kind: 'member',
                isTeamMember: true,
                avatarUrl: '/b.svg',
            },
        });
        retroRequest.mockResolvedValue({ actionItem: created });

        const { ctx } = actions();
        const field = screen.getByLabelText('Add an action item…');

        fireEvent.change(field, { target: { value: 'Rotate the on-call' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

        const [title, options] = vi.mocked(toast.success).mock.calls[0];
        const action = options?.action as {
            label: string;
            onClick: () => void;
        };

        expect(title).toBe('Action created');
        expect(options?.description).toBe('Bob Stone');
        expect(action.label).toBe('Undo');
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'actionItem.upsert',
            actionItem: created,
        });

        action.onClick();

        await waitFor(() => expect(callsTo('delete')).toHaveLength(1));
        expect(callsTo('delete')[0][0].url).toContain('/action-items/new');
        expect(screen.queryByRole('alertdialog')).toBeNull();
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'actionItem.remove',
                actionItemId: 'new',
            }),
        );
    });

    it('lists the open follow-ups of earlier retros with the actions of the retro, named after their retro, and counts them', () => {
        const carried = actionItemFixture({
            id: 'old',
            retroId: 'retro-0',
            content: 'Review the definition of ready',
            source: {
                retroTitle: 'Sprint 41',
                retroCreatedAt: '2026-09-18T10:00:00Z',
                retroUrl: '/retros/earlier',
            },
        });
        const { container } = actions({
            actionItems: [actionItemFixture()],
            carriedActionItems: [carried],
        });
        const panel = container.querySelector(
            '[data-test="retro-action-items-panel"]',
        ) as HTMLElement;
        const row = panel.querySelector('#carried-item-old') as HTMLElement;

        expect(
            within(panel).getByRole('heading', { name: /^Retro actions\s*2$/ }),
        ).toBeTruthy();
        expect(row.textContent).toContain('Review the definition of ready');
        expect(row.textContent).toContain('Sprint 41');
        expect(panel.querySelector('#action-item-old')).toBeNull();
    });

    it('keeps the follow-ups of earlier retros from a guest', () => {
        const { container } = actions({
            viewer: { isGuest: true, isFacilitator: false, userId: null },
            carriedActionItems: [actionItemFixture({ id: 'old' })],
        });

        expect(container.querySelector('#carried-item-old')).toBeNull();
    });

    it('changes a follow-up through the workspace routes', async () => {
        const carried = actionItemFixture({
            id: 'old',
            retroId: 'retro-0',
            status: 'doing',
        });
        retroRequest.mockResolvedValue({
            actionItem: { ...carried, status: 'completed' },
        });

        const { ctx, container } = actions({ carriedActionItems: [carried] });

        fireEvent.click(
            within(
                container.querySelector('#carried-item-old') as HTMLElement,
            ).getByRole('button', { name: 'Mark as done' }),
        );

        await waitFor(() => expect(callsTo('patch')).toHaveLength(1));
        expect(callsTo('patch')[0][0].url).toContain('/acme/action-items/old');
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'carriedActionItem.upsert',
                actionItem: { ...carried, status: 'completed' },
            }),
        );
    });
});

describe('the facilitator bar in Actions', () => {
    it('offers "Next topic" and "Next phase", and nothing else', () => {
        actions();

        const bar = screen.getByRole('toolbar', { name: 'Facilitation tools' });

        expect(
            within(bar)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Next topic', 'Next phase']);
    });

    it('opens on the most voted topic with "Next topic", then moves everyone down the list and stops at the end', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'slow' });

        const first = actions();

        fireEvent.click(screen.getByRole('button', { name: 'Next topic' }));

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'slow' });

        first.unmount();
        retroRequest.mockClear();

        const second = actions({ retro: { highlightedCardId: 'slow' } });

        fireEvent.click(screen.getByRole('button', { name: 'Next topic' }));

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'scope' });

        second.unmount();

        actions({ retro: { highlightedCardId: 'flaky' } });

        expect(
            screen
                .getByRole('button', { name: 'Next topic' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('goes to the ROTI with "Next phase"', async () => {
        const { ctx } = actions();

        fireEvent.click(screen.getByRole('button', { name: 'Next phase' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/phase'),
            }),
            { phase: 'roti' },
        );
    });
});

describe('PhaseActions on a phone', () => {
    beforeEach(() => {
        phone.on = true;
    });

    it('folds the topics behind their heading', () => {
        const { container } = actions();
        const toggle = screen.getByRole('button', {
            name: 'Most voted topics',
        });
        const list = container.querySelector(
            '[data-test="retro-topics"]',
        ) as HTMLElement;

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.closest('h2')).toBeTruthy();
        expect(list.closest('[hidden]')).toBeNull();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(list.closest('[hidden]')?.id).toBe(
            toggle.getAttribute('aria-controls'),
        );

        fireEvent.click(toggle);

        expect(list.closest('[hidden]')).toBeNull();
    });

    it('opens the form of a new action in a drawer', async () => {
        const { container } = actions();

        expect(
            container.querySelector('[data-slot="item-create-form"]'),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Create an action' }),
        );

        const drawer = await screen.findByRole('dialog', {
            name: 'New action item',
        });

        expect(
            drawer
                .querySelector('[data-slot="item-create-form"]')
                ?.getAttribute('data-layout'),
        ).toBe('stacked');
    });
});
