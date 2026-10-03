import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColumnsBoard } from '@/components/retro/columns-board';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => true,
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
    {
        id: 'keep',
        title: 'Keep',
        description: null,
        color: 'sky',
        position: 2,
    },
];

function card(overrides: Partial<BoardCard> = {}): BoardCard {
    return {
        id: 'c1',
        columnId: 'start',
        parentCardId: null,
        position: 0,
        isMine: true,
        hidden: false,
        content: 'Ship smaller pull requests',
        gif: null,
        author: { id: 'me', name: 'Alice Martin' },
        groupName: null,
        discussedAt: null,
        votes: null,
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
    card(),
    card({ id: 'c2', columnId: 'stop', content: 'Friday deploys' }),
];

function board(overrides: Parameters<typeof retroSnapshot>[0] = {}) {
    return renderInBoard(
        <ColumnsBoard hideMyCursor />,
        boardContext(retroSnapshot({ columns, cards, ...overrides })),
    );
}

function shownColumns(container: HTMLElement): string[] {
    return Array.from(
        container.querySelectorAll('[data-test^="retro-column-"]'),
    ).map((node) => node.getAttribute('data-test') ?? '');
}

function panel(container: HTMLElement): HTMLElement {
    const node = container.querySelector(
        '[data-slot="retro-columns"]',
    ) as HTMLElement;

    node.getBoundingClientRect = () =>
        ({ width: 390, height: 600, left: 0, top: 0 }) as DOMRect;

    return node;
}

function swipe(node: HTMLElement, from: number, to: number): void {
    fireEvent.pointerDown(node, { clientX: from, clientY: 300 });
    fireEvent.pointerUp(node, { clientX: to, clientY: 300 });
}

/**
 * A finger that starts on a card: the events bubble to the panel and to the
 * document, as they do in a browser.
 */
function swipeFromCard(container: HTMLElement, from: number, to: number): void {
    const node = container.querySelector('#card-c1') as HTMLElement;
    const finger = { pointerType: 'touch', isPrimary: true, button: 0 };

    panel(container);
    fireEvent.pointerDown(node, { ...finger, clientX: from, clientY: 300 });
    fireEvent.pointerMove(node, { ...finger, clientX: to, clientY: 300 });
    fireEvent.pointerUp(node, { ...finger, clientX: to, clientY: 300 });
}

function selectedTab(): string | null {
    return (
        screen
            .getAllByRole('tab')
            .find((tab) => tab.getAttribute('aria-selected') === 'true')
            ?.textContent ?? null
    );
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('ColumnsBoard on a phone', () => {
    it('shows one column, behind one tab per column', () => {
        const { container } = board();

        expect(
            within(
                screen.getByRole('tablist', { name: 'Columns' }),
            ).getAllByRole('tab'),
        ).toHaveLength(4);
        expect(selectedTab()).toContain('Start');
        expect(shownColumns(container)).toEqual(['retro-column-start']);
        expect(container.querySelector('#card-c1')).toBeTruthy();
        expect(container.querySelector('#card-c2')).toBeNull();

        const tabpanel = screen.getByRole('tabpanel');

        expect(tabpanel.getAttribute('data-slot')).toBe('retro-columns');
        expect(
            document.getElementById(
                tabpanel.getAttribute('aria-labelledby') ?? '',
            )?.textContent,
        ).toContain('Start');
    });

    it('changes the column from its tab, by a press and from the keyboard', () => {
        const { container } = board();

        fireEvent.click(screen.getByRole('tab', { name: /^Keep/ }));
        expect(shownColumns(container)).toEqual(['retro-column-keep']);

        fireEvent.keyDown(screen.getByRole('tab', { name: /^Keep/ }), {
            key: 'ArrowLeft',
        });
        expect(shownColumns(container)).toEqual(['retro-column-stop']);
        expect(container.querySelector('#card-c2')).toBeTruthy();
        expect(document.activeElement?.textContent).toContain('Stop');
    });

    it('goes to the next and the previous column on a swipe, and stops at the ends', () => {
        const { container } = board({ viewer: { isFacilitator: false } });

        swipe(panel(container), 300, 150);
        expect(shownColumns(container)).toEqual(['retro-column-stop']);
        expect(
            panel(container)
                .querySelector('[data-slide]')
                ?.getAttribute('data-slide'),
        ).toBe('next');

        swipe(panel(container), 100, 250);
        expect(shownColumns(container)).toEqual(['retro-column-start']);
        expect(
            panel(container)
                .querySelector('[data-slide]')
                ?.getAttribute('data-slide'),
        ).toBe('previous');

        swipe(panel(container), 100, 250);
        expect(shownColumns(container)).toEqual(['retro-column-start']);

        swipe(panel(container), 300, 250);
        expect(shownColumns(container)).toEqual(['retro-column-start']);
    });

    it.each(['writing', 'grouping'] as const)(
        'changes the column on a swipe that starts on a card in %s, and moves no card',
        async (phase) => {
            const { container } = board({
                retro: { phase },
                viewer: { isFacilitator: false },
                cards: [...cards, card({ id: 'c3', position: 1 })],
            });

            swipeFromCard(container, 300, 150);

            expect(selectedTab()).toContain('Stop');
            expect(shownColumns(container)).toEqual(['retro-column-stop']);

            await Promise.resolve();

            expect(retroRequest).not.toHaveBeenCalled();
        },
    );

    it('does not animate the slide for who prefers reduced motion', () => {
        const { container } = board();

        expect(
            panel(container)
                .querySelector('[data-slide]')
                ?.classList.contains('motion-reduce:animate-none'),
        ).toBe(true);
    });

    it('writes a card in the column on screen from the round button', async () => {
        retroRequest.mockResolvedValue({
            card: card({ id: 'c9', columnId: 'stop', content: 'Noisy alerts' }),
            writersCount: 1,
        });

        const { container, ctx } = board();

        expect(
            container.querySelector('[data-slot="retro-card-composer"]'),
        ).toBeNull();

        fireEvent.click(screen.getByRole('tab', { name: /^Stop/ }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add a card in Stop' }),
        );

        const drawer = await screen.findByRole('dialog', {
            name: 'Add a card in Stop',
        });
        const editor = within(drawer).getByLabelText('Add a card…');

        fireEvent.input(editor, { target: { value: 'Noisy alerts' } });
        fireEvent.submit(editor.closest('form') as HTMLFormElement);

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'cards.upsert',
                cards: [expect.objectContaining({ id: 'c9' })],
            }),
        );
        expect(retroRequest.mock.calls[0][1]).toMatchObject({
            column_id: 'stop',
            content: 'Noisy alerts',
        });
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'Add a card in Stop' }),
            ).toBeNull(),
        );
    });

    it('closes the card drawer with Cancel, without publishing', async () => {
        board();

        fireEvent.click(
            screen.getByRole('button', { name: 'Add a card in Start' }),
        );

        const drawer = await screen.findByRole('dialog', {
            name: 'Add a card in Start',
        });

        expect(
            within(drawer).getByRole('button', { name: 'Save' }),
        ).toBeTruthy();

        fireEvent.click(within(drawer).getByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'Add a card in Start' }),
            ).toBeNull(),
        );
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('keeps the card drawer closed once the session has expired', async () => {
        renderInBoard(
            <ColumnsBoard hideMyCursor />,
            boardContext(retroSnapshot({ columns, cards }), {
                sessionExpired: true,
            }),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Add a card in Start' }),
        );
        await Promise.resolve();

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('has no round button once writing is over', () => {
        board({ retro: { phase: 'grouping' } });
        expect(
            screen.queryByRole('button', { name: /^Add a card in/ }),
        ).toBeNull();
    });

    it('has no round button on a closed board', () => {
        board({ retro: { isLocked: true } });

        expect(
            screen.queryByRole('button', { name: /^Add a card in/ }),
        ).toBeNull();
    });

    it('keeps the budget of votes above the tabs while voting', () => {
        const { container } = board({ retro: { phase: 'voting' } });
        const head = container.querySelector(
            '[data-slot="retro-phone-columns-head"]',
        ) as HTMLElement;

        expect(head.classList.contains('sticky')).toBe(true);
        expect(head.querySelector('[data-slot="vote-budget"]')).toBeTruthy();
        expect(head.querySelector('[role="tablist"]')).toBeTruthy();
        expect(
            head.querySelector('[data-slot="retro-voting-progress"]'),
        ).toBeNull();
        expect(
            container.querySelectorAll('[data-slot="retro-voting-progress"]'),
        ).toHaveLength(1);
    });

    it('gives the facilitator a tab to add a column, and nobody else', () => {
        const { container, unmount } = board();

        fireEvent.click(screen.getByRole('tab', { name: 'Add column' }));
        expect(
            container.querySelector('[data-slot="retro-add-column"]'),
        ).toBeTruthy();
        expect(shownColumns(container)).toEqual([]);

        unmount();
        board({ viewer: { isFacilitator: false } });

        expect(screen.queryByRole('tab', { name: 'Add column' })).toBeNull();
    });

    it('brings the column of the card in focus in front', () => {
        const { container } = board({
            retro: { phase: 'voting', highlightedCardId: 'c2' },
        });

        expect(shownColumns(container)).toEqual(['retro-column-stop']);
    });

    it('says that there is no column, without tabs', () => {
        board({ columns: [], cards: [], viewer: { isFacilitator: false } });

        expect(screen.getByText('No columns yet.')).toBeTruthy();
        expect(screen.queryByRole('tablist')).toBeNull();
        expect(screen.queryByRole('tabpanel')).toBeNull();
    });
});
