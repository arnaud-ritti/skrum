import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardContext } from '@/components/retro/board-context';
import { GroupNameSuggestionsProvider } from '@/components/retro/board-group';
import { ColumnsBoard } from '@/components/retro/columns-board';
import type { BoardCard, BoardColumn } from '@/lib/retro/types';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import type { BoardContextValue } from '@/components/retro/board-context';
import {
    ActivityContext,
    type RetroActivity,
} from '@/hooks/use-retro-activity';
import { ActivityRefreshMs, type ActivityEntry } from '@/lib/retro/activity';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('sonner', async (importOriginal) => ({
    ...(await importOriginal<typeof import('sonner')>()),
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

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

    const openComposer = (container: HTMLElement, columnId: string) => {
        const column = container.querySelector(
            `[data-test="retro-column-${columnId}"]`,
        ) as HTMLElement;

        fireEvent.click(
            within(column).getByRole('button', { name: 'Add a card' }),
        );

        return column.querySelector('form') as HTMLFormElement;
    };

    it('ends each column with the "Add a card" button, and no card open for writing', () => {
        const { container } = board();

        expect(
            screen.getAllByRole('button', { name: 'Add a card' }),
        ).toHaveLength(2);
        expect(screen.queryByLabelText('Add a card…')).toBeNull();
        expect(
            container.querySelector('[data-slot="retro-card-composer"]'),
        ).toBeNull();
    });

    it('opens one card in editing from "Add a card", with Cancel, Save and the focus in its field', () => {
        const { container } = board();
        const form = openComposer(container, 'stop');
        const field = within(form).getByLabelText('Add a card…');

        expect(document.activeElement).toBe(field);
        expect(
            within(form).getByRole('button', { name: 'Cancel' }),
        ).toBeTruthy();
        expect(within(form).getByRole('button', { name: 'Save' })).toBeTruthy();
        expect(screen.getAllByLabelText('Add a card…')).toHaveLength(1);
        expect(
            screen.getAllByRole('button', { name: 'Add a card' }),
        ).toHaveLength(1);
    });

    it('opens the card in editing with N on the column', () => {
        const { container } = board();
        const column = container.querySelector(
            '[data-test="retro-column-start"]',
        ) as HTMLElement;

        column.focus();
        fireEvent.keyDown(column, { key: 'n' });

        expect(document.activeElement).toBe(
            within(column).getByLabelText('Add a card…'),
        );
    });

    it('closes the card in editing with Cancel, and gives the focus back to "Add a card"', () => {
        const { container } = board();
        const form = openComposer(container, 'stop');

        fireEvent.input(within(form).getByLabelText('Add a card…'), {
            target: { value: 'Never mind' },
        });
        fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByLabelText('Add a card…')).toBeNull();
        expect(retroRequest).not.toHaveBeenCalled();

        const column = container.querySelector(
            '[data-test="retro-column-stop"]',
        ) as HTMLElement;

        expect(document.activeElement).toBe(
            within(column).getByRole('button', { name: 'Add a card' }),
        );
    });

    it('closes the card in editing with Esc', () => {
        const { container } = board();
        const form = openComposer(container, 'start');

        fireEvent.keyDown(within(form).getByLabelText('Add a card…'), {
            key: 'Escape',
        });

        expect(screen.queryByLabelText('Add a card…')).toBeNull();
        expect(
            screen.getAllByRole('button', { name: 'Add a card' }),
        ).toHaveLength(2);
    });

    it('keeps GIF within reach of the card in editing', () => {
        const { container } = board({
            retro: { gifProvider: 'giphy', gifsEnabled: true },
        });
        const form = openComposer(container, 'start');

        expect(within(form).getByRole('button', { name: 'GIF' })).toBeTruthy();
    });

    it('invites to write in an empty column, above "Add a card"', () => {
        board({ cards: [card()] });

        expect(
            screen.getAllByText('No card yet. Be the first to write.'),
        ).toHaveLength(1);
    });

    it('publishes a card with Save, empties the field for the next one and takes the writers count', async () => {
        retroRequest.mockResolvedValue({
            card: card({ id: 'c9', content: 'Typed' }),
            writersCount: 2,
        });

        const { container, ctx } = board();
        const form = openComposer(container, 'stop');
        const field = form.querySelector('textarea') as HTMLTextAreaElement;
        const save = within(form).getByRole('button', {
            name: 'Save',
        }) as HTMLButtonElement;

        expect(save.disabled).toBe(true);

        fireEvent.input(field, { target: { value: '  Typed  ' } });

        expect(save.disabled).toBe(false);

        fireEvent.click(save);

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
        const field = openComposer(container, 'start').querySelector(
            'textarea',
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
        expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit card' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete card' }),
        ).toBeNull();
    });

    it('drops the card in editing when the board locks, and leaves the focus alone when it opens again', () => {
        const { container, rerender, ctx } = board();
        const at = (isLocked: boolean) => (
            <BoardContext
                value={{
                    ...ctx,
                    board: retroSnapshot({ columns, retro: { isLocked } }),
                }}
            >
                <ColumnsBoard hideMyCursor />
            </BoardContext>
        );

        openComposer(container, 'stop');
        rerender(at(true));
        (document.activeElement as HTMLElement | null)?.blur();
        rerender(at(false));

        expect(screen.queryByLabelText('Add a card…')).toBeNull();
        expect(document.activeElement).toBe(document.body);
        expect(
            screen.getAllByRole('button', { name: 'Add a card' }),
        ).toHaveLength(2);
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
    });

    it('says to wait when a column change comes while another is still on its way', async () => {
        retroRequest.mockReturnValue(new Promise(() => {}));

        board();

        const [startMenu] = screen.getAllByRole('button', {
            name: 'Column menu',
        });

        fireEvent.pointerDown(startMenu, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Move right' }),
        );

        fireEvent.pointerDown(startMenu, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'Move right' }),
        );

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith(
            'Too many changes, wait a moment.',
        );
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

    it('sorts by votes on the board of a completed retro, and lets a column keep the written order', () => {
        const { container } = board({
            retro: { phase: 'completed' },
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

describe('ColumnsBoard in Grouping', () => {
    const lead = card({ id: 'lead', content: 'Slow CI', isMine: false });
    const child = card({
        id: 'child',
        parentCardId: 'lead',
        content: 'Flaky tests',
        isMine: false,
    });
    const alone = card({
        id: 'alone',
        position: 1,
        content: 'Pairing works',
        isMine: false,
    });

    function grouping(
        overrides: Parameters<typeof retroSnapshot>[0] = {},
        context: Partial<BoardContextValue> = {},
    ) {
        const { retro, ...rest } = overrides;

        return renderInBoard(
            <GroupNameSuggestionsProvider>
                <ColumnsBoard hideMyCursor />
            </GroupNameSuggestionsProvider>,
            boardContext(
                retroSnapshot({
                    columns,
                    cards: [lead, child, alone],
                    retro: { phase: 'grouping', ...retro },
                    ...rest,
                }),
                context,
            ),
        );
    }

    it('says how to group, and counts the groups, the cards and the people', () => {
        const { container } = grouping();

        expect(
            screen.getByText(
                'Drag a card onto another to group them. Click a title to rename it.',
            ),
        ).toBeTruthy();
        expect(
            container.querySelector('[data-slot="retro-grouping-progress"]')
                ?.textContent,
        ).toBe('1 group · 3 cards');
        expect(
            container.querySelector('[data-slot="retro-grouping-online"]')
                ?.textContent,
        ).toBe('2 online');
        expect(
            container.querySelector('[data-slot="retro-writing-banner"]'),
        ).toBeNull();
    });

    it('starts the keyboard move of the focused card with G: its handle takes the focus and the Space key', () => {
        const { container } = grouping();
        const handle = container.querySelector(
            '[data-test="retro-card-handle-alone"]',
        ) as HTMLElement;
        const article = handle.querySelector(
            '[data-card-id="alone"]',
        ) as HTMLElement;
        const received: string[] = [];

        handle.addEventListener('keydown', (event) => {
            if (event.target === handle) {
                received.push(event.code);
            }
        });

        expect(handle.hasAttribute('data-drag-handle')).toBe(true);

        fireEvent.keyDown(article, { key: 'g' });

        expect(document.activeElement).toBe(handle);
        expect(received).toEqual(['Space']);
    });

    it('leaves G alone on a locked board, away from a card, and while single-key shortcuts are off', () => {
        const received: string[] = [];
        const listen = (container: HTMLElement) =>
            container.addEventListener('keydown', (event) => {
                if (event.code === 'Space') {
                    received.push(event.code);
                }
            });
        const cardOf = (container: HTMLElement) =>
            container.querySelector('[data-card-id="alone"]') as HTMLElement;

        const locked = grouping({ retro: { isLocked: true } });

        listen(locked.container);
        fireEvent.keyDown(cardOf(locked.container), { key: 'g' });
        locked.unmount();

        const open = grouping();

        listen(open.container);
        fireEvent.keyDown(document.body, { key: 'g' });
        setSingleKeyShortcuts(false);
        fireEvent.keyDown(cardOf(open.container), { key: 'g' });
        setSingleKeyShortcuts(true);

        expect(received).toEqual([]);
    });

    it('draws a group as a section around its cards, dragged by its lead', () => {
        const { container } = grouping();
        const group = container.querySelector('#group-lead') as HTMLElement;

        expect(group.matches('section[data-slot="card-group"]')).toBe(true);
        expect(group.querySelector('#card-lead')).not.toBeNull();
        expect(group.querySelector('#card-child')).not.toBeNull();
        expect(container.querySelector('#card-lead #card-child')).toBeNull();
        expect(
            container
                .querySelector('[data-test="retro-card-handle-lead"]')
                ?.contains(group),
        ).toBe(true);
        expect(
            container.querySelector('[data-test="retro-card-handle-child"]'),
        ).toBeNull();
        expect(
            container.querySelector(
                '[data-test="retro-card-handle-alone"] #card-alone [data-slot="retro-card-grip"]',
            ),
        ).not.toBeNull();
        expect(group.querySelector('[data-slot="retro-card-grip"]')).toBeNull();
    });

    it('invites to name a group that has no name, under the text of its first card', () => {
        const { container } = grouping();

        const title = container.querySelector(
            '#group-lead [data-slot="card-group-title"]',
        ) as HTMLElement;

        expect(title.tagName).toBe('BUTTON');
        expect(title.textContent).toBe('Slow CI · Name this group');
    });

    it('takes a card out of its group, the lead excepted', async () => {
        retroRequest.mockResolvedValue({ cards: [lead, child] });

        const { container, ctx } = grouping();

        expect(
            container.querySelector('#card-lead [aria-label="Ungroup"]'),
        ).toBeNull();

        fireEvent.click(
            container.querySelector(
                '#card-child [aria-label="Ungroup"]',
            ) as HTMLElement,
        );

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'cards.upsert',
                cards: [lead, child],
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'delete',
                url: expect.stringContaining('/cards/child/group'),
            }),
        );
    });

    it('names a group, shown at once, and clears the name when the field is emptied', async () => {
        const named = { ...lead, groupName: 'Delivery' };

        retroRequest.mockResolvedValue({
            cardId: 'lead',
            groupName: 'Delivery pain',
        });

        const { ctx } = grouping({ cards: [named, child] });

        fireEvent.click(screen.getByRole('button', { name: 'Rename group' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), {
            target: { value: ' Delivery pain ' },
        });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Group name' }), {
            key: 'Enter',
        });

        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'card.groupName',
            cardId: 'lead',
            groupName: 'Delivery pain',
        });
        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'put',
                    url: expect.stringContaining('/cards/lead/group-name'),
                }),
                { name: 'Delivery pain' },
            ),
        );

        retroRequest.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Rename group' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), {
            target: { value: '' },
        });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Group name' }), {
            key: 'Enter',
        });

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'delete' }),
            ),
        );
    });

    it('keeps a group readable and closed on a locked board', () => {
        const { container } = grouping({
            retro: { isLocked: true },
            cards: [{ ...lead, groupName: 'Delivery' }, child],
        });

        expect(
            screen.queryByRole('button', { name: 'Rename group' }),
        ).toBeNull();
        expect(container.querySelector('#group-lead')?.textContent).toContain(
            'Delivery',
        );
        expect(container.querySelector('[aria-label="Ungroup"]')).toBeNull();
        expect(
            container.querySelector('[data-slot="retro-card-grip"]'),
        ).toBeNull();
    });

    it('still names a group in Voting, without letting a card leave it', () => {
        const { container } = grouping({ retro: { phase: 'voting' } });

        expect(
            screen.getByRole('button', { name: /Name this group/ }),
        ).toBeTruthy();
        expect(container.querySelector('[aria-label="Ungroup"]')).toBeNull();
        expect(
            container.querySelector('[data-slot="retro-grouping-banner"]'),
        ).toBeNull();
    });

    describe('suggested names', () => {
        const withProvider = {
            retro: { aiSummaryEnabled: true },
            features: { llm: true, llmProvider: 'Anthropic' },
        };

        it('are not offered without a provider, on an opted-out retro, or once every group is named', () => {
            grouping();

            expect(
                screen.queryByRole('button', { name: 'Suggest group names' }),
            ).toBeNull();

            grouping({
                ...withProvider,
                retro: { aiSummaryEnabled: false },
            });
            grouping({
                ...withProvider,
                cards: [{ ...lead, groupName: 'Delivery' }, child],
            });

            expect(
                screen.queryByRole('button', { name: 'Suggest group names' }),
            ).toBeNull();
        });

        it('says where the cards go, shows the name on its group and saves it when it is kept', async () => {
            retroRequest.mockResolvedValueOnce({
                suggestions: [{ cardId: 'lead', name: 'Delivery pain' }],
            });

            const { container, ctx } = grouping(withProvider);

            expect(
                screen.getByText(
                    'Card contents of these groups are sent to Anthropic.',
                ),
            ).toBeTruthy();

            fireEvent.click(
                screen.getByRole('button', { name: 'Suggest group names' }),
            );

            const ghost = await waitFor(() => {
                const found = container.querySelector(
                    '#group-lead [title="Suggested name"]',
                );

                expect(found).not.toBeNull();

                return found as HTMLElement;
            });

            expect(ghost.textContent).toBe('Delivery pain');

            retroRequest.mockResolvedValueOnce({
                cardId: 'lead',
                groupName: 'Delivery pain',
            });
            fireEvent.click(
                screen.getByRole('button', { name: 'Use this name' }),
            );

            await waitFor(() =>
                expect(ctx.apply).toHaveBeenCalledWith({
                    type: 'card.groupName',
                    cardId: 'lead',
                    groupName: 'Delivery pain',
                }),
            );
            expect(retroRequest).toHaveBeenLastCalledWith(
                expect.objectContaining({ method: 'put' }),
                { name: 'Delivery pain' },
            );
            expect(
                container.querySelector('[title="Suggested name"]'),
            ).toBeNull();
        });

        it('opens the title field on the suggested name to change it first', async () => {
            retroRequest.mockResolvedValueOnce({
                suggestions: [{ cardId: 'lead', name: 'Delivery pain' }],
            });

            const { container } = grouping(withProvider);

            fireEvent.click(
                screen.getByRole('button', { name: 'Suggest group names' }),
            );
            fireEvent.click(
                await screen.findByRole('button', { name: 'Edit this name' }),
            );

            const field = screen.getByRole('textbox', {
                name: 'Group name',
            }) as HTMLInputElement;

            expect(field.value).toBe('Delivery pain');
            expect(
                container.querySelector('[title="Suggested name"]'),
            ).toBeNull();

            retroRequest.mockResolvedValueOnce({
                cardId: 'lead',
                groupName: 'Delivery pain',
            });
            fireEvent.keyDown(field, { key: 'Enter' });

            await waitFor(() =>
                expect(retroRequest).toHaveBeenLastCalledWith(
                    expect.objectContaining({ method: 'put' }),
                    { name: 'Delivery pain' },
                ),
            );
        });

        it('tells when there is nothing new to suggest', async () => {
            retroRequest.mockResolvedValueOnce({ suggestions: [] });

            const { container } = grouping(withProvider);

            fireEvent.click(
                screen.getByRole('button', { name: 'Suggest group names' }),
            );

            await waitFor(() =>
                expect(
                    (
                        screen.getByRole('button', {
                            name: 'Suggest group names',
                        }) as HTMLButtonElement
                    ).disabled,
                ).toBe(false),
            );
            expect(
                container.querySelector('[title="Suggested name"]'),
            ).toBeNull();
        });
    });
});

describe('ColumnsBoard reactions and comments', () => {
    const reacted = card({
        isMine: false,
        reactions: [
            { emoji: '👍', count: 1, mine: false, names: ['Bob Stone'] },
        ],
        commentCount: 1,
        comments: [
            {
                id: 'm1',
                cardId: 'c1',
                parentCommentId: null,
                isMine: false,
                deleted: false,
                content: 'Which pipeline is slow?',
                author: { id: 'bob', name: 'Bob Stone' },
                createdAt: '2026-10-02T10:00:00Z',
                replies: [],
            },
        ],
    });

    function engaged(
        overrides: Parameters<typeof retroSnapshot>[0] = {},
        context: Partial<BoardContextValue> = {},
    ) {
        const { retro, ...rest } = overrides;

        return renderInBoard(
            <ColumnsBoard hideMyCursor />,
            boardContext(
                retroSnapshot({
                    columns,
                    cards: [reacted],
                    retro: { phase: 'grouping', ...retro },
                    ...rest,
                }),
                context,
            ),
        );
    }

    it('adds my reaction to a chip at once, then takes the answer of the server', async () => {
        const answered = [
            {
                emoji: '👍',
                count: 2,
                mine: true,
                names: ['Bob Stone', 'Alice'],
            },
        ];

        retroRequest.mockResolvedValue({ cardId: 'c1', reactions: answered });

        const { ctx } = engaged();

        fireEvent.click(screen.getByRole('button', { name: '👍, 1 reaction' }));

        expect(ctx.dispatch).toHaveBeenCalledWith({
            type: 'reactions.set',
            cardId: 'c1',
            reactions: [
                { emoji: '👍', count: 2, mine: true, names: ['Bob Stone'] },
            ],
        });
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'reactions.set',
                cardId: 'c1',
                reactions: answered,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'put',
                url: expect.stringContaining('/cards/c1/reactions'),
            }),
            { emoji: '👍' },
        );
    });

    it('sends one request for two quick presses on the same chip', () => {
        retroRequest.mockReturnValue(new Promise(() => {}));

        engaged();

        const chip = screen.getByRole('button', { name: '👍, 1 reaction' });

        fireEvent.click(chip);
        fireEvent.click(chip);

        expect(retroRequest).toHaveBeenCalledTimes(1);
    });

    it('names the vote total of a card for screen readers', () => {
        engaged({
            cards: [{ ...reacted, votes: 2 }],
            retro: { phase: 'discussing' },
        });

        expect(screen.getByRole('img', { name: '2 votes' })).toBeTruthy();
    });

    it('takes my reaction back when I press my own chip', () => {
        engaged({
            cards: [
                {
                    ...reacted,
                    reactions: [
                        { emoji: '👍', count: 1, mine: true, names: [] },
                    ],
                },
            ],
        });

        fireEvent.click(screen.getByRole('button', { name: '👍, 1 reaction' }));

        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'delete' }),
            { emoji: '👍' },
        );
    });

    it('offers "Add a reaction" as a menu button on the card', () => {
        const { container } = engaged();
        const add = container.querySelector(
            '#card-c1 [aria-label="Add a reaction"]',
        ) as HTMLElement;

        expect(add.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('disables the chips and hides "Add a reaction" on a locked board, in Writing and once completed', () => {
        for (const retro of [
            { isLocked: true },
            { phase: 'writing' as const },
            { phase: 'completed' as const },
        ]) {
            const { container, unmount } = engaged({ retro });

            expect(
                (
                    screen.getByRole('button', {
                        name: '👍, 1 reaction',
                    }) as HTMLButtonElement
                ).disabled,
            ).toBe(true);
            expect(
                container.querySelector('[aria-label="Add a reaction"]'),
            ).toBeNull();

            unmount();
        }
    });

    it('shows no reaction when the retro has them off', () => {
        const { container } = engaged({ retro: { reactionsEnabled: false } });

        expect(
            container.querySelector('[data-slot="retro-card-reactions"]'),
        ).toBeNull();
    });

    it('opens the comments of a card, and writes one with Enter', async () => {
        retroRequest.mockResolvedValue({
            comment: { ...reacted.comments[0], id: 'm2', content: 'Deploy' },
        });

        const { container, ctx } = engaged();
        const toggle = screen.getByRole('button', { name: 'Comments (1)' });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('#card-c1 textarea')).toBeNull();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(
            container.querySelector('#card-c1 [data-slot="comment"]')
                ?.textContent,
        ).toContain('Which pipeline is slow?');
        expect(
            container.querySelector('#card-c1 [data-slot="comment"] p')
                ?.textContent,
        ).toBe('Bob Stone');

        const field = screen.getByLabelText('Write a comment…');

        fireEvent.change(field, { target: { value: ' Deploy ' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'comment.upsert' }),
            ),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/cards/c1/comments'),
            }),
            { content: 'Deploy', parentCommentId: null },
        );
    });

    it('lets the comments be read, not written, on a locked board', () => {
        const { container } = engaged({ retro: { isLocked: true } });

        fireEvent.click(screen.getByRole('button', { name: 'Comments (1)' }));

        expect(container.querySelector('#card-c1')?.textContent).toContain(
            'Which pipeline is slow?',
        );
        expect(container.querySelector('#card-c1 textarea')).toBeNull();
        expect(
            container.querySelector('[aria-label="Delete comment"]'),
        ).toBeNull();
    });

    it('marks a card with unread comments, and reads them when they are opened', () => {
        const markCommentsRead = vi.fn();
        const { container } = engaged(
            {},
            { unreadCardIds: new Set(['c1']), markCommentsRead },
        );

        expect(
            container.querySelector('#card-c1 [aria-label="Unread comments"]'),
        ).not.toBeNull();
        expect(markCommentsRead).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Comments (1)' }));

        expect(markCommentsRead).toHaveBeenCalledWith('c1');
    });

    it('has no comments on a card of the Writing phase nobody commented', () => {
        const { container } = engaged({
            retro: { phase: 'writing' },
            cards: [card({ commentCount: 0 })],
        });

        expect(
            container.querySelector('[data-slot="retro-card-comments"]'),
        ).toBeNull();
    });

    it('shows nothing of a card that is still hidden', () => {
        const { container } = engaged({
            retro: { phase: 'writing' },
            cards: [{ ...reacted, hidden: true, content: null }],
        });

        expect(
            container.querySelector('[data-slot="retro-card-reactions"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="retro-card-comments"]'),
        ).toBeNull();
    });
});

describe('ColumnsBoard in Voting', () => {
    const lead = card({
        id: 'lead',
        content: 'Slow CI',
        isMine: false,
        votes: 4,
        myVotes: 1,
    });
    const child = card({
        id: 'child',
        parentCardId: 'lead',
        content: 'Flaky tests',
        isMine: false,
    });
    const alone = card({
        id: 'alone',
        position: 1,
        content: 'Pairing works',
        isMine: false,
        votes: 2,
        myVotes: 0,
    });

    function voting(
        overrides: Parameters<typeof retroSnapshot>[0] = {},
        cards: BoardCard[] = [lead, child, alone],
    ) {
        const { retro, ...rest } = overrides;

        return renderInBoard(
            <GroupNameSuggestionsProvider>
                <ColumnsBoard hideMyCursor />
            </GroupNameSuggestionsProvider>,
            boardContext(
                retroSnapshot({
                    columns,
                    cards,
                    votesCast: 6,
                    retro: { phase: 'voting', ...retro },
                    ...rest,
                }),
            ),
        );
    }

    const query = (container: HTMLElement, selector: string) =>
        container.querySelector(selector) as HTMLElement;

    it('shows the vote bar above the columns, in Voting only', () => {
        const { container, unmount } = voting();

        expect(
            container.querySelector('[data-slot="retro-voting-bar"]'),
        ).not.toBeNull();
        unmount();

        expect(
            board({ retro: { phase: 'grouping' } }).container.querySelector(
                '[data-slot="retro-voting-bar"]',
            ),
        ).toBeNull();
    });

    it('votes on a card: shown at once, sent, then set to the answer of the server', async () => {
        retroRequest.mockResolvedValueOnce({
            cardId: 'alone',
            myVotes: 1,
            remainingVotes: 4,
            votesCast: 7,
            votesVersion: 9,
            total: 3,
        });

        const { container, ctx } = voting();

        fireEvent.click(
            query(container, '#card-alone [aria-label="Add a vote"]'),
        );

        expect(ctx.dispatch).toHaveBeenCalledWith({
            type: 'votes.tally',
            cardId: 'alone',
            myVotes: 1,
            remainingVotes: 4,
        });
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'votes.cast',
                votesCast: 7,
                votesVersion: 9,
                cardId: 'alone',
                total: 3,
            }),
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'votes.tally',
            cardId: 'alone',
            myVotes: 1,
            remainingVotes: 4,
            votesVersion: 9,
        });
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: expect.stringContaining('/cards/alone/votes'),
            }),
        );
    });

    it('takes the vote shown at once back when the server refuses it', async () => {
        retroRequest.mockRejectedValueOnce(new Error('refused'));

        const { container, ctx } = voting();

        fireEvent.click(
            query(container, '#card-alone [aria-label="Add a vote"]'),
        );

        await waitFor(() =>
            expect(ctx.dispatch).toHaveBeenLastCalledWith({
                type: 'votes.tally',
                cardId: 'alone',
                myVotes: 0,
                remainingVotes: 5,
            }),
        );
        expect(ctx.dispatch).toHaveBeenCalledTimes(2);
    });

    it('takes a refused vote back before the snapshot fetched after the refusal lands', async () => {
        retroRequest.mockRejectedValueOnce(new Error('timeout'));

        const snapshot = retroSnapshot({
            columns,
            cards: [lead, child, alone],
            votesCast: 6,
            retro: { phase: 'voting' },
        });
        const dispatch = vi.fn();
        const refetched = { type: 'replace', snapshot } as const;
        const { container } = renderInBoard(
            <GroupNameSuggestionsProvider>
                <ColumnsBoard hideMyCursor />
            </GroupNameSuggestionsProvider>,
            boardContext(snapshot, {
                dispatch,
                run: async (mutation) => {
                    try {
                        return await mutation;
                    } catch {
                        dispatch(refetched);

                        return undefined;
                    }
                },
            }),
        );

        fireEvent.click(
            query(container, '#card-alone [aria-label="Add a vote"]'),
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(refetched));
        expect(dispatch).toHaveBeenLastCalledWith(refetched);
    });

    it('takes a vote back from the card that has one of mine', async () => {
        const { container } = voting({}, [
            lead,
            child,
            { ...alone, myVotes: 2 },
        ]);

        expect(
            query(container, '#card-alone [aria-label="Your votes: 2"]'),
        ).not.toBeNull();

        fireEvent.click(
            query(container, '#card-alone [aria-label="Remove a vote"]'),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'delete',
                    url: expect.stringContaining('/cards/alone/votes'),
                }),
            ),
        );
    });

    it('names the total of a card for the browser suite, and has none while the totals are hidden', () => {
        const shown = voting();

        expect(
            query(shown.container, '#card-alone [aria-label="2 votes"]'),
        ).not.toBeNull();
        shown.unmount();

        const { container } = voting({}, [
            { ...lead, votes: null },
            child,
            { ...alone, votes: null },
        ]);

        // The vote bar says that the totals are hidden; the group does not say it again.
        expect(
            container.querySelector('#group-lead [data-slot="hidden-total"]'),
        ).toBeNull();

        const labels = Array.from(
            container.querySelectorAll('#card-alone [aria-label]'),
        ).map((element) => element.getAttribute('aria-label'));

        expect(labels.some((label) => /^\d+ votes?$/.test(label ?? ''))).toBe(
            false,
        );
    });

    it('says "1 vote" for a single vote', () => {
        const { container } = voting({}, [{ ...alone, votes: 1 }]);

        expect(
            query(container, '#card-alone [aria-label="1 vote"]'),
        ).not.toBeNull();
    });

    it('disables "Add a vote" once the budget is spent, says why, and still takes a vote back', () => {
        const { container } = voting({ viewer: { remainingVotes: 0 } }, [
            lead,
            child,
            { ...alone, myVotes: 1 },
        ]);
        const add = query(
            container,
            '#card-alone [aria-label="Add a vote"]',
        ) as HTMLButtonElement;

        expect(add.disabled).toBe(true);
        expect(add.closest('[role="group"]')?.getAttribute('aria-label')).toBe(
            'You have used all your votes',
        );
        expect(
            (
                query(
                    container,
                    '#card-alone [aria-label="Remove a vote"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('stops the votes of one card at the cap, says why, and still takes one back', () => {
        const { container } = voting(
            { retro: { maxVotesPerCard: 2 }, viewer: { remainingVotes: 3 } },
            [{ ...lead, myVotes: 2 }, child, { ...alone, myVotes: 2 }],
        );

        const add = query(
            container,
            '#card-alone [aria-label="Add a vote"]',
        ) as HTMLButtonElement;

        expect(add.disabled).toBe(true);
        expect(add.closest('[role="group"]')?.getAttribute('aria-label')).toBe(
            'Max 2 votes per card',
        );
        expect(
            (
                query(
                    container,
                    '#card-alone [aria-label="Remove a vote"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(false);

        const groupAdd = query(
            container,
            '#group-lead [aria-label="Add a vote"]',
        ) as HTMLButtonElement;

        expect(groupAdd.disabled).toBe(true);
        expect(
            groupAdd.closest('[role="group"]')?.getAttribute('aria-label'),
        ).toBe('You reached the limit of 2 votes on this card');
        expect(
            container.querySelector('#group-lead [aria-label="Remove a vote"]'),
        ).not.toBeNull();
    });

    it('closes the votes of a closed board, with its reason', () => {
        const { container } = voting({ retro: { isLocked: true } }, [
            { ...lead, myVotes: 1 },
            child,
            { ...alone, myVotes: 1 },
        ]);

        for (const scope of ['#card-alone', '#group-lead']) {
            const add = query(
                container,
                `${scope} [aria-label="Add a vote"]`,
            ) as HTMLButtonElement;

            expect(add.disabled).toBe(true);
            expect(
                add.closest('[role="group"]')?.getAttribute('aria-label'),
            ).toBe('Board closed for editing');
            expect(
                container.querySelector(
                    `${scope} [aria-label="Remove a vote"]`,
                ),
            ).toBeNull();
        }
    });

    it('votes on a group from its "Group vote" line, not from its cards', async () => {
        const { container } = voting();
        const line = query(
            container,
            '#group-lead [data-slot="card-group-votes"]',
        );

        expect(line.textContent).toContain('Group vote');
        expect(
            container.querySelector('#card-lead [aria-label="Add a vote"]'),
        ).toBeNull();
        expect(
            container.querySelector('#card-child [aria-label="Add a vote"]'),
        ).toBeNull();
        expect(
            line.querySelector('[aria-label="Your votes: 1"]'),
        ).not.toBeNull();
        expect(
            line.querySelector('[data-slot="vote-total"]')?.textContent,
        ).toBe('4 votes');

        fireEvent.click(
            line.querySelector('[aria-label="Add a vote"]') as HTMLElement,
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'post',
                    url: expect.stringContaining('/cards/lead/votes'),
                }),
            ),
        );
    });

    it('has no vote control outside Voting', () => {
        const { container } = voting({ retro: { phase: 'discussing' } });

        expect(container.querySelector('[aria-label="Add a vote"]')).toBeNull();
        expect(
            container.querySelector('[data-slot="card-group-votes"]'),
        ).toBeNull();
    });
});

describe('ColumnsBoard activity (RT-1)', () => {
    function withActivity(
        entries: ActivityEntry[],
        overrides: Parameters<typeof retroSnapshot>[0] = {},
    ) {
        const activity: RetroActivity = {
            entries,
            writingCount: 0,
            announce: vi.fn(),
            end: vi.fn(),
        };
        const rendered = renderInBoard(
            <ActivityContext value={activity}>
                <GroupNameSuggestionsProvider>
                    <ColumnsBoard hideMyCursor />
                </GroupNameSuggestionsProvider>
            </ActivityContext>,
            boardContext(retroSnapshot({ columns, ...overrides })),
        );

        return { activity, ...rendered };
    }

    const live = (
        senderId: string,
        kind: ActivityEntry['kind'],
        targetId: string,
    ): ActivityEntry => ({
        senderId,
        kind,
        targetId,
        expiresAt: Number.MAX_SAFE_INTEGER,
    });

    it('says under the cards of a column who is writing in it, above "Add a card"', () => {
        const { container } = withActivity([live('bob', 'writing', 'start')]);
        const start = container.querySelector(
            '[data-test="retro-column-start"]',
        ) as HTMLElement;
        const stop = container.querySelector(
            '[data-test="retro-column-stop"]',
        ) as HTMLElement;
        const line = start.querySelector('[data-slot="retro-activity"]');

        expect(line?.getAttribute('data-kind')).toBe('writing');
        expect(line?.textContent).toBe('Bob is writing a card…');
        expect(
            line?.compareDocumentPosition(
                start.querySelector(
                    '[data-slot="retro-column-add"]',
                ) as HTMLElement,
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(stop.querySelector('[data-slot="retro-activity"]')).toBeNull();
        expect(
            stop.querySelector('[data-slot="retro-column-empty"]'),
        ).not.toBeNull();
    });

    it('says in Grouping who moves a card of the column', () => {
        const { container } = withActivity([live('bob', 'moving', 'c1')], {
            cards: [card({ isMine: false })],
            retro: { phase: 'grouping' },
        });
        const line = container.querySelector('[data-slot="retro-activity"]');

        expect(line?.getAttribute('data-kind')).toBe('moving');
        expect(line?.textContent).toBe('Bob is moving a card…');
    });

    it('announces writing in the column while a card is typed, and ends it on Cancel', () => {
        const { activity, container } = withActivity([]);
        const start = container.querySelector(
            '[data-test="retro-column-start"]',
        ) as HTMLElement;

        fireEvent.click(
            within(start).getByRole('button', { name: 'Add a card' }),
        );

        const form = start.querySelector(
            '[data-slot="retro-card-composer"]',
        ) as HTMLElement;

        fireEvent.input(within(form).getByLabelText('Add a card…'), {
            target: { value: 'Pair more' },
        });

        expect(activity.announce).toHaveBeenCalledWith('writing', 'start');

        fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

        expect(activity.end).toHaveBeenCalledWith('writing', 'start');
    });

    it('announces writing while one of my cards is edited, and ends it on Cancel', () => {
        const { activity, container } = withActivity([], {
            cards: [card()],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));
        fireEvent.input(
            container.querySelector('#card-c1 textarea') as HTMLElement,
            { target: { value: 'Ship smaller and smaller pull requests' } },
        );

        expect(activity.announce).toHaveBeenCalledWith('writing', 'start');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(activity.end).toHaveBeenCalledWith('writing', 'start');
    });

    it('ends the writing of an edited card once its text is cleared', () => {
        const { activity, container } = withActivity([], {
            cards: [card()],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));

        const field = container.querySelector(
            '#card-c1 textarea',
        ) as HTMLElement;

        fireEvent.input(field, { target: { value: 'Ship smaller' } });
        fireEvent.input(field, { target: { value: '  ' } });

        expect(activity.end).toHaveBeenCalledWith('writing', 'start');
    });

    it('keeps announcing writing while the author picks a GIF for the card', () => {
        const { activity, container } = withActivity([], {
            retro: { gifProvider: 'giphy', gifsEnabled: true },
        });
        const start = container.querySelector(
            '[data-test="retro-column-start"]',
        ) as HTMLElement;

        fireEvent.click(
            within(start).getByRole('button', { name: 'Add a card' }),
        );

        const form = start.querySelector(
            '[data-slot="retro-card-composer"]',
        ) as HTMLElement;
        const field = within(form).getByLabelText('Add a card…');

        fireEvent.input(field, { target: { value: 'Pair more' } });
        fireEvent.click(within(form).getByRole('button', { name: 'GIF' }));
        fireEvent.focusOut(field, {
            relatedTarget: screen.getByRole('dialog', { name: 'Choose a GIF' }),
        });

        expect(activity.end).not.toHaveBeenCalled();
    });

    it('ends nothing when a card nobody edits here leaves the column', () => {
        const { activity, ctx, rerender } = withActivity([], {
            cards: [card({ isMine: false })],
        });

        rerender(
            <BoardContext
                value={{ ...ctx, board: { ...ctx.board, cards: [] } }}
            >
                <ActivityContext value={activity}>
                    <GroupNameSuggestionsProvider>
                        <ColumnsBoard hideMyCursor />
                    </GroupNameSuggestionsProvider>
                </ActivityContext>
            </BoardContext>,
        );

        expect(activity.end).not.toHaveBeenCalled();
    });

    it('ends the writing of a card edited here when it leaves the column', () => {
        const { activity, container, ctx, rerender } = withActivity([], {
            cards: [card()],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));
        fireEvent.input(
            container.querySelector('#card-c1 textarea') as HTMLElement,
            { target: { value: 'Ship smaller pull requests' } },
        );
        rerender(
            <BoardContext
                value={{ ...ctx, board: { ...ctx.board, cards: [] } }}
            >
                <ActivityContext value={activity}>
                    <GroupNameSuggestionsProvider>
                        <ColumnsBoard hideMyCursor />
                    </GroupNameSuggestionsProvider>
                </ActivityContext>
            </BoardContext>,
        );

        expect(activity.end).toHaveBeenCalledWith('writing', 'start');
    });

    it('keeps announcing a card held longer than the others remember it', () => {
        vi.useFakeTimers();

        try {
            const { activity, container } = withActivity([], {
                cards: [card({ isMine: false })],
                retro: { phase: 'grouping' },
            });
            const handle = container.querySelector(
                '[data-test="retro-card-handle-c1"]',
            ) as HTMLElement;

            fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
            act(() => {
                vi.advanceTimersByTime(ActivityRefreshMs * 3);
            });

            expect(
                vi
                    .mocked(activity.announce)
                    .mock.calls.filter(([kind]) => kind === 'moving').length,
            ).toBeGreaterThanOrEqual(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it('announces the move of a card picked up from the keyboard, and its end', async () => {
        const { activity, container } = withActivity([], {
            cards: [card({ isMine: false })],
            retro: { phase: 'grouping' },
        });
        const handle = container.querySelector(
            '[data-test="retro-card-handle-c1"]',
        ) as HTMLElement;

        fireEvent.keyDown(handle, { code: 'Space', key: ' ' });

        expect(activity.announce).toHaveBeenCalledWith('moving', 'c1');

        await waitFor(() =>
            expect(handle.getAttribute('aria-pressed')).toBe('true'),
        );
        fireEvent.keyDown(handle, { code: 'Escape', key: 'Escape' });

        await waitFor(() =>
            expect(activity.end).toHaveBeenCalledWith('moving', 'c1'),
        );
    });
});
