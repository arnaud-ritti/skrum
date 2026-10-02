import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardProvider } from '@/components/retro/board-context';
import type { BoardContextValue } from '@/components/retro/board-context';
import { GroupNameSuggestionsProvider } from '@/components/retro/board-group';
import { FacilitatorDock } from '@/components/retro/facilitator-dock';
import {
    DiscussionProvider,
    PhaseDiscussing,
    PresentationOverlay,
} from '@/components/retro/phase-discussing';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
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

function snapshot({ retro, ...rest }: Overrides = {}) {
    return retroSnapshot({
        columns,
        cards,
        ...rest,
        retro: { phase: 'discussing', ...retro },
    });
}

function Discussion() {
    return (
        <GroupNameSuggestionsProvider>
            <DiscussionProvider>
                <PhaseDiscussing hideMyCursor />
                <FacilitatorDock />
                <PresentationOverlay />
            </DiscussionProvider>
        </GroupNameSuggestionsProvider>
    );
}

function discussion(
    overrides: Overrides = {},
    ctx: Partial<BoardContextValue> = {},
) {
    return renderInBoard(
        <Discussion />,
        boardContext(snapshot(overrides), ctx),
    );
}

const topicIds = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-test="retro-topics"] > li')].map(
        (row) => row.getAttribute('data-topic-id'),
    );

const currentTopic = (container: HTMLElement) =>
    container
        .querySelector('[data-test="retro-topics"] > li[aria-current="true"]')
        ?.getAttribute('data-topic-id');

const row = (container: HTMLElement, id: string) =>
    container.querySelector(
        `[data-test="retro-topics"] > li[data-topic-id="${id}"] button`,
    ) as HTMLElement;

const highlightCalls = () =>
    retroRequest.mock.calls.filter(([route]) =>
        String(route.url).endsWith('/highlight'),
    );

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
    phone.on = false;
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('PhaseDiscussing', () => {
    it('lists the topics by votes, in an ordered list, and opens on the most voted', () => {
        const { container } = discussion();
        const list = container.querySelector('[data-test="retro-topics"]');

        expect(list?.tagName).toBe('OL');
        expect(topicIds(container)).toEqual(['slow', 'scope', 'flaky']);
        expect(currentTopic(container)).toBe('slow');
        expect(row(container, 'scope').textContent).toContain('Scope changes');
        expect(row(container, 'scope').textContent).toContain('2 votes');
        expect(
            row(container, 'scope')
                .querySelector('[data-slot="retro-topic-swatch"]')
                ?.getAttribute('data-color'),
        ).toBe('coral');
        expect(screen.getByText('Topic 1 of 3')).toBeTruthy();
    });

    it('says which topic is selected on the button that takes the focus', () => {
        const { container } = discussion();

        expect(row(container, 'slow').getAttribute('aria-current')).toBe(
            'true',
        );
        expect(row(container, 'scope').hasAttribute('aria-current')).toBe(
            false,
        );

        fireEvent.click(row(container, 'scope'));

        expect(row(container, 'scope').getAttribute('aria-current')).toBe(
            'true',
        );
        expect(row(container, 'slow').hasAttribute('aria-current')).toBe(false);
    });

    it('draws the topic in focus as its card, with the ids of the board, and no other card', () => {
        const { container } = discussion();
        const focus = container.querySelector(
            '[data-slot="retro-topic-focus"]',
        ) as HTMLElement;

        expect(focus.getAttribute('aria-label')).toBe(
            'Topic in focus: Slow CI, 1 card, 3 votes',
        );
        expect(focus.querySelector('#card-slow')).not.toBeNull();
        expect(
            focus.querySelector('#card-slow [aria-label="3 votes"]'),
        ).not.toBeNull();
        expect(
            focus.querySelector('#card-slow [aria-label="Comments (0)"]'),
        ).not.toBeNull();
        expect(
            within(focus).getByRole('button', { name: 'Discuss' }),
        ).toBeTruthy();
        expect(container.querySelector('#card-flaky')).toBeNull();
        expect(
            container.querySelector('[data-test^="retro-column-"]'),
        ).toBeNull();
    });

    it('draws a group as its group, renamed in place', () => {
        const { container } = discussion();

        fireEvent.click(row(container, 'scope'));

        const focus = container.querySelector(
            '[data-slot="retro-topic-focus"]',
        ) as HTMLElement;

        expect(currentTopic(container)).toBe('scope');
        expect(focus.textContent).toContain('Group of 2 cards · column “Stop”');
        expect(focus.querySelector('#group-scope #card-scope')).not.toBeNull();
        expect(
            focus.querySelector('#group-scope #card-scope-2'),
        ).not.toBeNull();
        expect(
            within(focus).getByRole('button', { name: 'Rename group' }),
        ).toBeTruthy();
        expect(focus.querySelector('[aria-label="Ungroup"]')).toBeNull();
    });

    it('moves with "Next topic" and "Previous topic", says what is up next, and stops at the ends', () => {
        const { container } = discussion();
        const nav = container.querySelector(
            '[data-slot="retro-topic-nav"]',
        ) as HTMLElement;
        const previous = within(nav).getByRole('button', {
            name: 'Previous topic',
        }) as HTMLButtonElement;
        const next = within(nav).getByRole('button', {
            name: 'Next topic',
        }) as HTMLButtonElement;

        expect(previous.disabled).toBe(true);
        expect(
            container.querySelector('[data-slot="retro-topic-next"]')
                ?.textContent,
        ).toContain('#2 · Scope changes');

        fireEvent.click(next);
        fireEvent.click(next);

        expect(currentTopic(container)).toBe('flaky');
        expect(next.disabled).toBe(true);
        expect(
            container.querySelector('[data-slot="retro-topic-next"]'),
        ).toBeNull();

        fireEvent.click(previous);

        expect(currentTopic(container)).toBe('scope');
        expect(highlightCalls()).toHaveLength(0);
    });

    it('keeps the action items and the suggestions beside the topic, and leaves the rating to the ROTI phase', () => {
        const { container } = discussion({
            actionItems: [actionItemFixture()],
            insights: {
                themes: [{ id: 't1', name: 'Delivery', cardIds: ['slow'] }],
                suggestedActions: [],
            },
        });
        const panels = container.querySelector(
            '[data-slot="retro-discussion-panels"]',
        ) as HTMLElement;

        expect(
            panels.querySelector('[data-test="retro-action-items-panel"]'),
        ).not.toBeNull();
        expect(panels.querySelector('#action-item-item-1')).not.toBeNull();
        expect(
            within(panels).getByLabelText('Add an action item…'),
        ).toBeTruthy();
        expect(
            within(panels).getByRole('complementary', { name: 'Suggestions' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('group', { name: 'How was this retro?' }),
        ).toBeNull();
        expect(screen.getByText('1 action so far')).toBeTruthy();
    });

    it('says so when the retro has no card, and still takes action items', () => {
        const { container } = discussion({ cards: [] });

        expect(screen.getByText('No topics to discuss.')).toBeTruthy();
        expect(
            container.querySelector('[data-test="retro-topics"]')?.children,
        ).toHaveLength(0);
        expect(screen.getByLabelText('Add an action item…')).toBeTruthy();
    });
});

describe('the topic of everyone', () => {
    it('brings every viewer to the highlighted topic, and marks it in the list', () => {
        const { container, rerender, ctx } = discussion({
            viewer: { isFacilitator: false },
        });

        fireEvent.click(row(container, 'flaky'));
        expect(currentTopic(container)).toBe('flaky');

        rerender(
            <BoardProvider
                value={{
                    ...ctx,
                    board: snapshot({
                        viewer: { isFacilitator: false },
                        retro: { highlightedCardId: 'scope' },
                    }),
                }}
            >
                <Discussion />
            </BoardProvider>,
        );

        expect(currentTopic(container)).toBe('scope');
        expect(
            container
                .querySelector('[data-test="retro-topics"] > li[data-shared]')
                ?.getAttribute('data-topic-id'),
        ).toBe('scope');
        expect(
            container
                .querySelector('#card-scope')
                ?.getAttribute('data-focused'),
        ).toBe('true');
        expect(
            container.querySelector('[data-slot="retro-topic-follow"]'),
        ).toBeNull();
    });

    it('lets a participant browse elsewhere while everyone follows, and brings them back', () => {
        const { container } = discussion({
            viewer: { isFacilitator: false, participantId: 'bob' },
            retro: { presentationMode: true, highlightedCardId: 'scope' },
        });

        // The presented topic is closed by the participant for themselves.
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(currentTopic(container)).toBe('scope');
        expect(
            container.querySelector('[data-slot="retro-topic-follow"]')
                ?.textContent,
        ).toContain(
            'Alice Martin put this topic in focus — everyone is looking here',
        );

        fireEvent.click(row(container, 'slow'));

        expect(currentTopic(container)).toBe('slow');
        expect(
            container.querySelector('[data-slot="retro-topic-follow"]')
                ?.textContent,
        ).toContain('Everyone is looking at another topic.');

        fireEvent.click(
            screen.getByRole('button', { name: 'Back to the topic' }),
        );

        expect(currentTopic(container)).toBe('scope');
        expect(highlightCalls()).toHaveLength(0);
    });

    it('highlights the topic the facilitator moves to while everyone follows, and none while they do not', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });

        const followed = discussion({ retro: { presentationMode: true } });

        fireEvent.click(row(followed.container, 'scope'));

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'scope' });
        expect(followed.ctx.apply).toHaveBeenCalledWith({
            type: 'highlight.set',
            cardId: 'scope',
        });

        followed.unmount();
        retroRequest.mockClear();

        const free = discussion();

        fireEvent.click(row(free.container, 'scope'));

        expect(currentTopic(free.container)).toBe('scope');
        expect(highlightCalls()).toHaveLength(0);
    });

    it('gives the facilitator bar "Everyone follows" and the two moves', async () => {
        const { container, ctx } = discussion();
        const bar = screen.getByRole('toolbar', { name: 'Facilitation tools' });
        const follow = within(bar).getByRole('button', {
            name: 'Everyone follows',
        });

        expect(follow.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(
            within(bar).getByRole('button', { name: 'Next topic' }),
        );

        expect(currentTopic(container)).toBe('scope');

        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });
        fireEvent.click(follow);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('/settings'),
                }),
                { presentation_mode: true },
            ),
        );
        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        await waitFor(() =>
            expect(highlightCalls().at(-1)?.[1]).toEqual({ card_id: 'scope' }),
        );
    });
});

describe('PresentationOverlay', () => {
    it('shows the highlighted topic over the board while everyone follows, with its controls', () => {
        const { container } = discussion({
            retro: { presentationMode: true, highlightedCardId: 'slow' },
            cards: cards.map((candidate) =>
                candidate.id === 'slow'
                    ? {
                          ...candidate,
                          commentCount: 1,
                          reactions: [
                              {
                                  emoji: '👍',
                                  count: 1,
                                  mine: false,
                                  names: ['Carol Reyes'],
                              },
                          ],
                      }
                    : candidate,
            ),
        });
        const overlay = screen.getByRole('dialog');

        expect(overlay.textContent).toContain('Slow CI');
        expect(overlay.textContent).toContain('3 votes');
        expect(
            within(overlay).getByRole('button', { name: '👍, 1 reaction' }),
        ).toBeTruthy();
        expect(
            within(overlay).getByRole('button', { name: 'Comments (1)' }),
        ).toBeTruthy();
        expect(
            within(overlay).getByRole('button', { name: 'Stop presenting' }),
        ).toBeTruthy();
        // One card, one id: the board leaves the topic to the overlay.
        expect(document.querySelectorAll('#card-slow')).toHaveLength(1);
        expect(
            container.querySelector('[data-slot="retro-topic-focus"]'),
        ).toBeNull();
    });

    it('is closed once the session has expired, so that the banner and its "Reload" are reachable', () => {
        discussion(
            { retro: { presentationMode: true, highlightedCardId: 'slow' } },
            { sessionExpired: true },
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('stays closed without the presentation mode', () => {
        discussion({ retro: { highlightedCardId: 'slow' } });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('stops presenting for everyone when the facilitator closes it', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: null });

        const { ctx } = discussion({
            retro: { presentationMode: true, highlightedCardId: 'slow' },
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Stop presenting' }),
        );

        await waitFor(() =>
            expect(highlightCalls()[0]?.[1]).toEqual({ card_id: null }),
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'highlight.set',
            cardId: null,
        });
    });

    it('moves everyone to the next topic from the overlay', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });

        discussion({
            retro: { presentationMode: true, highlightedCardId: 'slow' },
        });

        fireEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Next topic',
            }),
        );

        await waitFor(() =>
            expect(highlightCalls()[0]?.[1]).toEqual({ card_id: 'scope' }),
        );
    });

    it('is closed by a participant for themselves only, and has no "Stop presenting" for them', () => {
        discussion({
            viewer: { isFacilitator: false, participantId: 'bob' },
            retro: { presentationMode: true, highlightedCardId: 'slow' },
        });

        expect(
            screen.queryByRole('button', { name: 'Stop presenting' }),
        ).toBeNull();

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(highlightCalls()).toHaveLength(0);
        expect(document.querySelector('#card-slow')).not.toBeNull();
    });
});

describe('PhaseDiscussing on a phone', () => {
    beforeEach(() => {
        phone.on = true;
    });

    function swipe(container: HTMLElement, from: number, to: number): void {
        const stage = container.querySelector(
            '[data-slot="retro-topic-stage"]',
        ) as HTMLElement;

        stage.getBoundingClientRect = () =>
            ({ width: 390, height: 600, left: 0, top: 0 }) as DOMRect;
        fireEvent.pointerDown(stage, { clientX: from, clientY: 300 });
        fireEvent.pointerUp(stage, { clientX: to, clientY: 300 });
    }

    it('shows the topic in front and keeps the list behind a selector that says where one is', () => {
        const { container } = discussion();
        const selector = screen.getByRole('button', {
            name: /Topic 1 of 3\s*Slow CI/,
        });

        expect(selector.getAttribute('aria-expanded')).toBe('false');
        expect(selector.textContent).toContain('1/3');
        expect(
            container.querySelector('[data-test="retro-topics"]'),
        ).toBeNull();
        expect(container.querySelector('#card-slow')).toBeTruthy();
    });

    it('opens the topics in a drawer, and closes it on the topic chosen', async () => {
        const { container } = discussion({
            viewer: { isFacilitator: false },
        });

        fireEvent.click(screen.getByRole('button', { name: /Topic 1 of 3/ }));

        const drawer = await screen.findByRole('dialog', { name: 'Topics' });

        expect(
            [...drawer.querySelectorAll('[data-test="retro-topics"] > li')].map(
                (item) => item.getAttribute('data-topic-id'),
            ),
        ).toEqual(['slow', 'scope', 'flaky']);

        fireEvent.click(
            drawer.querySelector(
                '[data-test="retro-topics"] > li[data-topic-id="flaky"] button',
            ) as HTMLElement,
        );

        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: 'Topics' })).toBeNull(),
        );
        expect(
            screen.getByRole('button', { name: /Topic 3 of 3\s*Flaky tests/ }),
        ).toBeTruthy();
        expect(container.querySelector('#card-flaky')).toBeTruthy();
    });

    it('keeps the topics drawer closed once the session has expired', async () => {
        discussion(
            { viewer: { isFacilitator: false } },
            { sessionExpired: true },
        );

        fireEvent.click(screen.getByRole('button', { name: /Topic 1 of 3/ }));
        await Promise.resolve();

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('moves to the next and the previous topic on a swipe', () => {
        const { container } = discussion({
            viewer: { isFacilitator: false },
        });

        swipe(container, 300, 150);
        expect(
            screen.getByRole('button', { name: /Topic 2 of 3/ }),
        ).toBeTruthy();

        swipe(container, 100, 250);
        expect(
            screen.getByRole('button', { name: /Topic 1 of 3/ }),
        ).toBeTruthy();

        swipe(container, 100, 250);
        expect(
            screen.getByRole('button', { name: /Topic 1 of 3/ }),
        ).toBeTruthy();
    });

    it('has no selector when the retro has no card', () => {
        discussion({ cards: [] });

        expect(screen.queryByRole('button', { name: /^Topic/ })).toBeNull();
        expect(screen.getByText('No topics to discuss.')).toBeTruthy();
    });
});

describe('F, the focus of a topic from the keyboard', () => {
    it('highlights the topic of the focused row, and takes the highlight back on the one in focus', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });

        const free = discussion();

        fireEvent.keyDown(row(free.container, 'scope'), { key: 'f' });

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'scope' });
        free.unmount();
        retroRequest.mockClear();
        retroRequest.mockResolvedValue({ highlightedCardId: null });

        const shared = discussion({ retro: { highlightedCardId: 'scope' } });

        fireEvent.keyDown(row(shared.container, 'scope'), { key: 'f' });

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: null });
    });

    it('answers on the card of the topic in front, a card of its group included', async () => {
        retroRequest.mockResolvedValue({ highlightedCardId: 'scope' });

        const { container } = discussion();

        fireEvent.click(row(container, 'scope'));
        fireEvent.keyDown(
            container.querySelector('[data-card-id="scope-2"]') as HTMLElement,
            { key: 'f' },
        );

        await waitFor(() => expect(highlightCalls()).toHaveLength(1));
        expect(highlightCalls()[0][1]).toEqual({ card_id: 'scope' });
    });

    it('does nothing away from a card or a topic, for a participant, in another phase, or while single-key shortcuts are off', () => {
        const facilitator = discussion();

        fireEvent.keyDown(document.body, { key: 'f' });
        setSingleKeyShortcuts(false);
        fireEvent.keyDown(row(facilitator.container, 'scope'), { key: 'f' });
        setSingleKeyShortcuts(true);
        facilitator.unmount();

        const participant = discussion({ viewer: { isFacilitator: false } });

        fireEvent.keyDown(row(participant.container, 'scope'), { key: 'f' });
        participant.unmount();

        const voting = renderInBoard(
            <DiscussionProvider>
                <div data-card-id="scope" tabIndex={0} />
            </DiscussionProvider>,
            boardContext(snapshot({ retro: { phase: 'voting' } })),
        );

        fireEvent.keyDown(
            voting.container.querySelector('[data-card-id]') as HTMLElement,
            { key: 'f' },
        );

        expect(highlightCalls()).toHaveLength(0);
    });
});
