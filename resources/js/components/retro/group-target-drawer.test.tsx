import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    GroupTargetDrawer,
    groupTargets,
} from '@/components/retro/group-target-drawer';
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
        content: 'Slow CI',
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

const slow = card();
const cards = [
    slow,
    card({ id: 'alone', content: 'Flaky tests', position: 1 }),
    card({
        id: 'lead',
        content: 'Reviews wait for days',
        groupName: 'Reviews',
        position: 2,
    }),
    card({
        id: 'child',
        parentCardId: 'lead',
        content: 'No reviewer on Friday',
    }),
    card({ id: 'elsewhere', columnId: 'stop', content: 'Friday deploys' }),
];

function drawer(
    overrides: Parameters<typeof retroSnapshot>[0] = {},
    onOpenChange = vi.fn(),
) {
    return {
        onOpenChange,
        ...renderInBoard(
            <GroupTargetDrawer card={slow} open onOpenChange={onOpenChange} />,
            boardContext(
                retroSnapshot({
                    columns,
                    cards,
                    ...overrides,
                    retro: { phase: 'grouping', ...overrides.retro },
                }),
            ),
        ),
    };
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('groupTargets', () => {
    it('lists the groups of the column first, then its lone cards, and never the card itself', () => {
        expect(
            groupTargets(slow, cards).map((target) => [
                target.card.id,
                target.size,
            ]),
        ).toEqual([
            ['lead', 2],
            ['alone', 1],
        ]);
    });
});

describe('GroupTargetDrawer', () => {
    it('names a group by its name and its size, a lone card by its text', async () => {
        drawer();

        const dialog = await screen.findByRole('dialog', {
            name: 'Add to a group',
        });

        expect(
            within(dialog)
                .getAllByRole('button')
                .filter((button) => button.hasAttribute('data-target-id'))
                .map((button) => button.textContent),
        ).toEqual(['Reviews2 cards', 'Flaky tests']);
        expect(within(dialog).getByText('Slow CI')).toBeTruthy();
    });

    it('groups the card under the one chosen and closes', async () => {
        const grouped = [{ ...slow, parentCardId: 'lead' }];

        retroRequest.mockResolvedValue({ cards: grouped });

        const { ctx, onOpenChange } = drawer();
        const dialog = await screen.findByRole('dialog');

        fireEvent.click(within(dialog).getByText('Reviews'));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'cards.upsert',
                cards: grouped,
            }),
        );
        expect(retroRequest.mock.calls[0][0].url).toContain('/cards/c1/group');
        expect(retroRequest.mock.calls[0][1]).toEqual({
            parent_card_id: 'lead',
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('stays open when the server refuses', async () => {
        retroRequest.mockRejectedValue(new Error('refused'));

        const { ctx, onOpenChange } = drawer();
        const dialog = await screen.findByRole('dialog');

        fireEvent.click(within(dialog).getByText('Flaky tests'));

        await waitFor(() => expect(retroRequest).toHaveBeenCalledTimes(1));
        expect(ctx.apply).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('says so when the card is alone in its column', async () => {
        drawer({ cards: [slow] });

        expect(
            within(await screen.findByRole('dialog')).getByText(
                'No other card in this column.',
            ),
        ).toBeTruthy();
    });
});
