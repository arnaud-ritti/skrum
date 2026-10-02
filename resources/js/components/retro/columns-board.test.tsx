import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColumnsBoard } from '@/components/retro/columns-board';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
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
        isMine: true,
        hidden: false,
        content: 'Ship smaller pull requests',
        gif: null,
        author: { id: 'me', name: 'Alice Martin' },
        groupName: null,
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

const theirs = card({
    id: 'c2',
    isMine: false,
    hidden: true,
    content: null,
    author: null,
    position: 1,
});

function board(overrides: Parameters<typeof retroSnapshot>[0] = {}) {
    return renderInBoard(
        <ColumnsBoard hideMyCursor />,
        boardContext(retroSnapshot({ columns, ...overrides })),
    );
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('ColumnsBoard in Writing', () => {
    it('counts the cards and who has written over the people present', () => {
        const { container } = board({
            cards: [card(), theirs],
            writersCount: 1,
        });

        expect(
            container.querySelector('[data-slot="retro-writing-progress"]')
                ?.textContent,
        ).toBe('2 cards · 1/2 have written');
        expect(
            screen.getByText(
                'Silent writing: your cards are only visible to you until the reveal.',
            ),
        ).toBeTruthy();
    });

    it('has no banner outside Writing', () => {
        const { container } = board({ retro: { phase: 'grouping' } });

        expect(
            container.querySelector('[data-slot="retro-writing-banner"]'),
        ).toBeNull();
    });

    it('keeps the hooks of the browser suite on a column and its cards', () => {
        const { container } = board({ cards: [card(), theirs] });
        const start = container.querySelector(
            '[data-test="retro-column-start"]',
        ) as HTMLElement;

        expect(start.matches('section.col-moss')).toBe(true);
        expect(start.querySelector('#card-c1')?.textContent).toContain(
            'Ship smaller pull requests',
        );
        expect(start.querySelector('#card-c2')?.textContent).toContain(
            'Hidden until the reveal',
        );
        expect(
            start.querySelector('[data-test="retro-card-handle-c1"]'),
        ).not.toBeNull();
        expect(container.querySelectorAll('article[id^="card-"]')).toHaveLength(
            2,
        );
    });

    it('says under my own card that only I can read it, and not under the others', () => {
        const { container } = board({ cards: [card(), theirs] });

        expect(
            container.querySelector(
                '#card-c1 [data-slot="retro-card-only-you"]',
            )?.textContent,
        ).toBe('Visible only to you');
        expect(
            container.querySelector(
                '#card-c2 [data-slot="retro-card-only-you"]',
            ),
        ).toBeNull();
    });

    it('offers one composer per column, named "Add a card…", inside a form', () => {
        const { container } = board();

        expect(screen.getAllByLabelText('Add a card…')).toHaveLength(2);
        expect(
            container.querySelectorAll(
                '[data-test^="retro-column-"] form textarea',
            ),
        ).toHaveLength(2);
        expect(document.activeElement).toBe(document.body);
    });

    it('invites to write in an empty column, above its composer', () => {
        board({ cards: [card()] });

        expect(
            screen.getAllByText('No card yet. Be the first to write.'),
        ).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();
    });

    it('publishes a card from the composer, empties it and takes the writers count', async () => {
        retroRequest.mockResolvedValue({
            card: card({ id: 'c9', content: 'Typed' }),
            writersCount: 2,
        });

        const { container, ctx } = board();
        const form = container.querySelector(
            '[data-test="retro-column-stop"] form',
        ) as HTMLFormElement;
        const field = form.querySelector('textarea') as HTMLTextAreaElement;
        const add = form.querySelector(
            'button:not([type="button"])',
        ) as HTMLButtonElement;

        expect(add.disabled).toBe(true);

        fireEvent.input(field, { target: { value: '  Typed  ' } });

        expect(add.disabled).toBe(false);

        fireEvent.click(add);

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'writers.set',
                writersCount: 2,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/cards'),
            }),
            { column_id: 'stop', content: 'Typed', gif_id: null },
        );
        expect(ctx.apply).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'cards.upsert' }),
        );
        expect(
            (
                container.querySelector(
                    '[data-test="retro-column-stop"] form textarea',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('');
    });

    it('publishes with Enter', async () => {
        retroRequest.mockResolvedValue({ card: card(), writersCount: 1 });

        const { container } = board();
        const field = container.querySelector(
            '[data-test="retro-column-start"] form textarea',
        ) as HTMLTextAreaElement;

        fireEvent.change(field, { target: { value: 'Typed without a mouse' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(expect.anything(), {
                column_id: 'start',
                content: 'Typed without a mouse',
                gif_id: null,
            }),
        );
    });

    it('has no composer, no edit and no delete on a locked board', () => {
        board({ cards: [card()], retro: { isLocked: true } });

        expect(screen.queryByLabelText('Add a card…')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit card' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete card' }),
        ).toBeNull();
    });

    it('saves an edited card with the Save button', async () => {
        retroRequest.mockResolvedValue({
            card: card({ content: 'Ship much smaller pull requests' }),
        });

        const { container, ctx } = board({ cards: [card()] });

        fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));

        const field = container.querySelector(
            '#card-c1 textarea',
        ) as HTMLTextAreaElement;

        fireEvent.change(field, {
            target: { value: 'Ship much smaller pull requests' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'cards.upsert' }),
            ),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/cards/c1'),
            }),
            { content: 'Ship much smaller pull requests' },
        );
        await waitFor(() =>
            expect(container.querySelector('#card-c1 textarea')).toBeNull(),
        );
    });

    it('deletes a card once, then takes the snapshot for the writers count', async () => {
        const { ctx } = board({ cards: [card()] });
        const remove = screen.getByRole('button', { name: 'Delete card' });

        fireEvent.click(remove);
        fireEvent.click(remove);

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalledTimes(1));
        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'card.remove',
            cardId: 'c1',
            ungroupedCards: [],
        });
    });
});

describe('ColumnsBoard columns', () => {
    it('gives the column menu and the add-column form to the facilitator only', () => {
        const facilitator = board();

        expect(
            screen.getAllByRole('button', { name: 'Column menu' }),
        ).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Add column' })).toBeTruthy();
        expect(
            facilitator.container.querySelector(
                'form:has([role="radiogroup"]) input[aria-label="Column title"]',
            ),
        ).not.toBeNull();
        facilitator.unmount();

        board({ viewer: { isFacilitator: false } });

        expect(
            screen.queryByRole('button', { name: 'Column menu' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add column' })).toBeNull();
    });

    it('closes the column structure once Writing is over', () => {
        board({ retro: { phase: 'grouping' } });

        expect(
            screen.queryByRole('button', { name: 'Column menu' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add column' })).toBeNull();
        expect(
            screen.getAllByText('Drag cards onto each other to group them.'),
        ).toHaveLength(2);
    });

    it('adds a column and resets the form', async () => {
        retroRequest.mockResolvedValue({ columns });

        const { ctx } = board();
        const title = screen.getByLabelText('Column title') as HTMLInputElement;

        fireEvent.change(title, { target: { value: ' Kudos ' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'columns.set',
                columns,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/columns'),
            }),
            { title: 'Kudos', color: 'sky' },
        );
        await waitFor(() => expect(title.value).toBe(''));
        expect(
            screen
                .getByRole('radio', { name: 'Moss' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('shows an empty state on a board without column', () => {
        board({ columns: [] });

        expect(screen.getByText('No columns yet.')).toBeTruthy();
    });

    it('sorts by votes in the discussion, and lets a column keep the written order', () => {
        const { container } = board({
            retro: { phase: 'discussing' },
            cards: [
                card({ id: 'low', votes: 1 }),
                card({ id: 'high', votes: 3, position: 1 }),
            ],
        });
        const order = () =>
            [
                ...container.querySelectorAll(
                    '[data-test="retro-column-start"] article[id^="card-"]',
                ),
            ].map((article) => article.id);

        expect(order()).toEqual(['card-high', 'card-low']);

        fireEvent.click(
            container.querySelector(
                '[data-test="retro-column-start"] [data-test="retro-sort-by-votes"]',
            ) as HTMLElement,
        );

        expect(order()).toEqual(['card-low', 'card-high']);
    });
});
