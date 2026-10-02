import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    PokerResultPanel,
    PokerTable,
    suggestedEstimate,
} from '@/components/skrum/poker-table';
import type {
    PokerResult,
    PokerSeat,
    PokerTableProps,
} from '@/components/skrum/poker-table';
import type { PokerPlayer, PokerRound } from '@/lib/poker/types';
import { renderWithProviders } from '@/test/render';

function seat(
    index: number,
    state: PokerSeat['state'],
    value?: string,
    name = `Person${index}`,
): PokerSeat {
    return {
        user: {
            id: `u${index}`,
            name,
            presence: (index % 12) + 1,
        },
        state,
        value,
    };
}

const story = { key: 'ATLAS-1290', title: 'Export CSV' };

const dispersion: PokerResult = {
    average: 7.9,
    mode: ['5'],
    consensus: false,
    nearestCard: '8',
    distribution: [
        { value: '3', count: 1 },
        { value: '5', count: 3 },
        { value: '8', count: 2 },
        { value: '21', count: 1 },
    ],
};

const consensus: PokerResult = {
    average: 7.5,
    mode: ['8'],
    consensus: true,
    nearestCard: '8',
    distribution: [
        { value: '5', count: 1 },
        { value: '8', count: 5 },
    ],
};

function renderTable(props: Partial<PokerTableProps> = {}) {
    return renderWithProviders(
        <PokerTable
            story={story}
            seats={[
                seat(0, 'voted', undefined, 'Camille'),
                seat(1, 'waiting', undefined, 'Theo'),
                seat(2, 'absent', undefined, 'Malik'),
                seat(3, 'voted', undefined, 'Sofia'),
            ]}
            revealed={false}
            {...props}
        />,
    );
}

describe('PokerTable while voting', () => {
    it('names the seats Players and each seat card as the game page did', () => {
        const { rerender } = renderTable();

        expect(screen.getByRole('region', { name: 'Players' })).toBeTruthy();
        expect(
            screen.getByRole('img', { name: 'Camille: Voted' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('img', { name: 'Theo: Not voted yet' }),
        ).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Malik: Absent' })).toBeTruthy();
        expect(
            document.querySelectorAll('[aria-label="Camille: Voted"]'),
        ).toHaveLength(1);

        rerender(
            <PokerTable
                story={story}
                seats={[
                    {
                        ...seat(0, 'voted', undefined, 'Camille'),
                        user: { id: 'u0', name: 'Camille', isMe: true },
                    },
                ]}
                revealed={false}
                tableLabel="Poker table, ATLAS-1290"
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Poker table, ATLAS-1290' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('img', { name: 'Camille: Voted' }),
        ).toBeTruthy();
        expect(screen.getByText('You')).toBeTruthy();
    });

    it('announces progress excluding absent seats and shows no average', () => {
        renderTable();

        expect(screen.getByRole('status').textContent).toBe('2 of 3 voted');
        expect(screen.queryByText('Average')).toBeNull();
    });

    it('keeps a face-down value out of the DOM', () => {
        const { container } = renderTable({
            seats: [seat(0, 'voted', '8', 'Camille')],
        });

        expect(
            container.querySelector('[data-slot="poker-seat-card"]')
                ?.textContent,
        ).toBe('');
        expect(
            container
                .querySelector('[data-slot="poker-card"]')
                ?.getAttribute('data-face'),
        ).toBe('down');
        expect(screen.queryByText('8')).toBeNull();
    });

    it('reveals through the button and the R key for the facilitator only', () => {
        const onReveal = vi.fn();
        const { unmount } = renderTable({ isFacilitator: true, onReveal });

        fireEvent.click(screen.getByRole('button', { name: 'Show votes' }));
        fireEvent.keyDown(document, { key: 'r' });

        expect(onReveal).toHaveBeenCalledTimes(2);
        unmount();

        const guestReveal = vi.fn();
        renderTable({ onReveal: guestReveal });
        fireEvent.keyDown(document, { key: 'r' });

        expect(screen.queryByRole('button', { name: 'Show votes' })).toBeNull();
        expect(guestReveal).not.toHaveBeenCalled();
    });

    it('disables the reveal while nobody voted or while busy', () => {
        const onReveal = vi.fn();
        const { rerender } = renderTable({
            isFacilitator: true,
            onReveal,
            seats: [seat(0, 'waiting'), seat(1, 'waiting')],
        });
        const button = (): HTMLButtonElement =>
            screen.getByRole('button', { name: 'Show votes' });
        const isUnavailable = (): boolean =>
            button().getAttribute('aria-disabled') === 'true';

        expect(isUnavailable()).toBe(true);
        fireEvent.click(button());
        fireEvent.keyDown(document, { key: 'r' });
        expect(onReveal).not.toHaveBeenCalled();

        rerender(
            <PokerTable
                story={story}
                seats={[seat(0, 'voted'), seat(1, 'waiting')]}
                revealed={false}
                isFacilitator
                onReveal={onReveal}
            />,
        );
        expect(isUnavailable()).toBe(false);

        rerender(
            <PokerTable
                story={story}
                seats={[seat(0, 'voted'), seat(1, 'waiting')]}
                revealed={false}
                isFacilitator
                busy
                onReveal={onReveal}
            />,
        );
        expect(isUnavailable()).toBe(true);
        expect(button().disabled).toBe(false);
        fireEvent.click(button());
        expect(onReveal).not.toHaveBeenCalled();
    });

    it('moves focus to the result when the reveal button goes away, and back to the seats on a re-vote', () => {
        const onReveal = vi.fn();
        const onRevote = vi.fn();
        const voting = (
            <PokerTable
                story={story}
                seats={[seat(0, 'voted', undefined, 'Camille')]}
                revealed={false}
                isFacilitator
                onReveal={onReveal}
                onRevote={onRevote}
            />
        );
        const { rerender } = renderWithProviders(voting);
        const reveal = screen.getByRole('button', { name: 'Show votes' });

        reveal.focus();
        fireEvent.click(reveal);
        rerender(
            <PokerTable
                story={story}
                seats={[seat(0, 'voted', '8', 'Camille')]}
                revealed
                result={consensus}
                isFacilitator
                onReveal={onReveal}
                onRevote={onRevote}
            />,
        );

        expect(document.activeElement).toBe(
            screen.getByRole('region', { name: 'Result' }),
        );
        expect(screen.getByRole('status').textContent).toBe(
            'Votes revealed. Average: 7.5. Consensus',
        );

        const revote = screen.getByRole('button', { name: 'Re-vote' });

        revote.focus();
        fireEvent.click(revote);
        rerender(voting);

        expect(document.activeElement).toBe(
            screen.getByRole('region', { name: 'Players' }),
        );
    });

    it('leaves focus alone on a reveal when it was outside the table', () => {
        const { rerender } = renderWithProviders(
            <>
                <button type="button">Elsewhere</button>
                <PokerTable story={story} seats={[]} revealed={false} />
            </>,
        );
        const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });

        elsewhere.focus();
        rerender(
            <>
                <button type="button">Elsewhere</button>
                <PokerTable
                    story={story}
                    seats={[]}
                    revealed
                    result={consensus}
                />
            </>,
        );

        expect(document.activeElement).toBe(elsewhere);
    });

    it('does not reveal when R is typed in a dialog that was open before the first vote', async () => {
        const onReveal = vi.fn();
        const table = (seats: PokerSeat[]) => (
            <PokerTable
                story={story}
                seats={seats}
                revealed={false}
                isFacilitator
                onReveal={onReveal}
            />
        );
        const { rerender } = renderWithProviders(table([seat(0, 'waiting')]));
        const dialog = document.createElement('div');
        const button = document.createElement('button');

        dialog.setAttribute('role', 'dialog');
        dialog.append(button);
        document.body.append(dialog);

        rerender(table([seat(0, 'voted')]));
        await Promise.resolve();
        fireEvent.keyDown(button, { key: 'r' });
        dialog.remove();

        expect(onReveal).not.toHaveBeenCalled();

        fireEvent.keyDown(document.body, { key: 'r' });

        expect(onReveal).toHaveBeenCalledTimes(1);
    });

    it('turns the shortcuts off with shortcuts={false}', () => {
        const onReveal = vi.fn();
        renderTable({ isFacilitator: true, onReveal, shortcuts: false });

        fireEvent.keyDown(document, { key: 'r' });

        expect(onReveal).not.toHaveBeenCalled();
    });

    it('does not reveal when R is pressed inside a dialog opened over the table', async () => {
        const onReveal = vi.fn();
        const { container } = renderTable({ isFacilitator: true, onReveal });

        await Promise.resolve();

        const dialog = document.createElement('div');
        const button = document.createElement('button');

        dialog.setAttribute('role', 'dialog');
        dialog.append(button);
        container.append(dialog);
        fireEvent.keyDown(button, { key: 'r' });

        expect(onReveal).not.toHaveBeenCalled();
    });

    it('offers the next task and the voting tools slot to the facilitator', () => {
        const onNext = vi.fn();
        renderTable({
            isFacilitator: true,
            onNext,
            votingTools: <button type="button">Timer</button>,
        });

        const tools = screen.getByRole('group', { name: 'Facilitator tools' });

        expect(
            within(tools).getByRole('button', { name: 'Timer' }),
        ).toBeTruthy();
        fireEvent.click(
            within(tools).getByRole('button', { name: 'Next task' }),
        );
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('seats watchers in a Watching row and leaves them out of the progress', () => {
        const seatMenu = vi.fn((current: PokerSeat) => (
            <button type="button">{`Role of ${current.user.name}`}</button>
        ));
        renderTable({
            seats: [
                seat(0, 'voted', undefined, 'Camille'),
                seat(1, 'waiting', undefined, 'Theo'),
                seat(2, 'watching', undefined, 'Olga'),
            ],
            seatMenu,
        });

        const watching = screen.getByRole('region', { name: 'Watching' });

        expect(within(watching).getByText('Olga')).toBeTruthy();
        expect(
            within(watching).getByRole('button', { name: 'Role of Olga' }),
        ).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe('1 of 2 voted');
        expect(screen.queryByRole('group', { name: /^Olga/ })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Role of Camille' }),
        ).toBeTruthy();
    });

    it('marks the facilitator seat and an offline voter', () => {
        const { container } = renderTable({
            facilitatorId: 'u0',
            seats: [
                seat(0, 'voted', undefined, 'Camille'),
                { ...seat(1, 'voted', undefined, 'Theo'), offline: true },
            ],
        });

        expect(screen.getByRole('img', { name: 'Facilitator' })).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Theo: Voted' })).toBeTruthy();
        expect(screen.getByText('Offline').closest('[aria-hidden]')).toBeNull();
        expect(
            container.querySelectorAll('[data-slot="poker-seat-facilitator"]'),
        ).toHaveLength(1);
    });

    it('passes the avatar URL to the seat avatar', () => {
        const { container } = renderTable({
            seats: [
                {
                    user: {
                        id: 'p1',
                        name: 'Camille',
                        avatarUrl: 'https://example.test/camille.svg',
                    },
                    state: 'waiting',
                },
            ],
        });

        expect(
            container.querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();
    });
});

describe('PokerTable revealed', () => {
    const seats = [
        seat(0, 'voted', '5', 'Camille'),
        seat(1, 'voted', '21', 'Yuki'),
        seat(2, 'voted', '3', 'Lucas'),
        seat(3, 'voted', '☕', 'Malik'),
    ];

    it('accepts the server round and players as they are', () => {
        const round: Pick<PokerRound, 'result' | 'anonymous' | 'revealReason'> =
            {
                anonymous: false,
                revealReason: 'everyone_voted',
                result: {
                    average: 4,
                    distribution: [
                        { value: '3', count: 1 },
                        { value: '5', count: 1 },
                    ],
                    mode: ['3', '5'],
                    consensus: false,
                    nearestCard: '5',
                },
            };
        const players: PokerPlayer[] = [
            {
                id: 'p1',
                name: 'Camille',
                avatarUrl: '/a.svg',
                isGuest: false,
                isSpectator: false,
            },
        ];

        renderWithProviders(
            <PokerTable
                story={story}
                seats={players.map((player) => ({
                    user: player,
                    state: 'voted',
                    value: '3',
                }))}
                revealed
                result={round.result}
                anonymous={round.anonymous}
                revealReason={round.revealReason}
            />,
        );

        expect(screen.getAllByText('4').length).toBeGreaterThan(0);
        expect(screen.getByText('3, 5')).toBeTruthy();
        expect(screen.getByText('Nearest card')).toBeTruthy();
        expect(
            screen.getByText('Revealed automatically — everyone voted'),
        ).toBeTruthy();
        expect(screen.queryByText('Median')).toBeNull();
        expect(screen.queryByText('Agreement')).toBeNull();
    });

    it('shows the optional statistics only when they are given', () => {
        renderTable({
            seats,
            revealed: true,
            result: {
                ...dispersion,
                median: 5,
                agreement: 0.43,
                outliers: ['u1', 'u2'],
            },
        });

        expect(screen.getAllByText('7.9').length).toBeGreaterThan(0);
        expect(screen.getByText('Median')).toBeTruthy();
        expect(screen.getByText('43%')).toBeTruthy();
        expect(screen.getByText('Result · 7 votes')).toBeTruthy();
        expect(screen.getByText('Spread 3 → 21')).toBeTruthy();
        expect(
            screen.getByText(
                'Yuki (21) and Lucas (3) explain their estimates, then we revote.',
            ),
        ).toBeTruthy();
    });

    it('marks outlier cards and names them for assistive tech', () => {
        const { container } = renderTable({
            seats,
            revealed: true,
            result: { ...dispersion, outliers: ['u1', 'u2'] },
        });

        expect(
            container.querySelectorAll(
                '[data-slot="poker-seat-card"][data-outlier]',
            ),
        ).toHaveLength(2);
        expect(screen.getByRole('img', { name: 'Yuki: 21' })).toBeTruthy();
        expect(screen.getAllByText('Worth discussing')).toHaveLength(2);
        expect(screen.getByRole('img', { name: 'Malik: ☕' })).toBeTruthy();
    });

    it('takes the outliers and the missing agreement as the server sends them', () => {
        const { container } = renderTable({
            seats,
            revealed: true,
            result: {
                ...dispersion,
                agreement: null,
                outliers: { low: ['u2'], high: ['u1'] },
            },
        });

        expect(
            container.querySelectorAll(
                '[data-slot="poker-seat-card"][data-outlier]',
            ),
        ).toHaveLength(2);
        expect(screen.queryByText('Agreement')).toBeNull();
    });

    it('keeps a non-numeric spread and shows the most played cards without an average', () => {
        renderTable({
            seats,
            revealed: true,
            isNumeric: false,
            result: {
                average: null,
                nearestCard: null,
                consensus: false,
                mode: ['M', 'L'],
                distribution: [
                    { value: '½', count: 1 },
                    { value: 'M', count: 2 },
                    { value: 'L', count: 2 },
                    { value: '?', count: 1 },
                ],
            },
        });

        expect(screen.getByText('Spread ½ → L')).toBeTruthy();
        expect(screen.getAllByText('M, L').length).toBeGreaterThan(0);
        expect(screen.queryByText('Average')).toBeNull();
        expect(
            document.querySelectorAll(
                '[data-slot="poker-dist-bar"][data-mode]',
            ),
        ).toHaveLength(2);
    });

    it('says when no vote can be counted', () => {
        renderTable({
            seats,
            revealed: true,
            result: {
                average: null,
                nearestCard: null,
                consensus: false,
                mode: [],
                distribution: [{ value: '?', count: 2 }],
            },
        });

        expect(screen.getAllByText('No countable votes').length).toBe(2);
        expect(screen.queryByText('Needs discussion')).toBeNull();
    });

    it('keeps seats face down on an anonymous round and lists the values without names', () => {
        const { container } = renderTable({
            seats,
            revealed: true,
            anonymous: true,
            result: { ...dispersion, outliers: ['u1'] },
        });

        expect(screen.getByRole('img', { name: 'Yuki: Voted' })).toBeTruthy();
        expect(
            container.querySelectorAll(
                '[data-slot="poker-seat-card"][data-face="up"]',
            ),
        ).toHaveLength(0);
        expect(
            container.querySelectorAll(
                '[data-slot="poker-seat-card"][data-outlier]',
            ),
        ).toHaveLength(0);

        const anonymousVotes = screen.getByRole('region', {
            name: 'Anonymous votes',
        });

        expect(within(anonymousVotes).getAllByRole('img')).toHaveLength(7);
        expect(screen.queryByText(/Yuki \(21\)/)).toBeNull();
    });

    it('describes the distribution and offers a table view', () => {
        renderTable({ seats, revealed: true, result: dispersion });

        expect(
            screen.getByRole('img', {
                name: 'Distribution: 3 × 1, 5 × 3, 8 × 2, 21 × 1',
            }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'View as table' }));

        const table = screen.getByRole('table');
        expect(within(table).getByText('21')).toBeTruthy();
        expect(screen.queryByRole('img', { name: /^Distribution/ })).toBeNull();
    });

    it('offers re-vote, the estimate defaulting to the nearest card, save and next', () => {
        const onRevote = vi.fn();
        const onAccept = vi.fn();
        const onNext = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: dispersion,
            isFacilitator: true,
            estimateValues: ['3', '5', '8', '13', '21'],
            onRevote,
            onAccept,
            onNext,
        });

        expect(
            screen.getByRole('combobox', { name: 'Estimate' }).textContent,
        ).toContain('8');

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));
        fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
        fireEvent.click(screen.getByRole('button', { name: 'Next task' }));
        fireEvent.keyDown(document, { key: 'n' });

        expect(onRevote).toHaveBeenCalledTimes(1);
        expect(onAccept).toHaveBeenCalledTimes(2);
        expect(onAccept).toHaveBeenCalledWith('8');
        expect(onNext).toHaveBeenCalledTimes(2);
    });

    it('does not accept or go next when the key is typed in a dialog that was open while the actions were busy', async () => {
        const onAccept = vi.fn();
        const onNext = vi.fn();
        const table = (busy: boolean) => (
            <PokerTable
                story={story}
                seats={seats}
                revealed
                result={dispersion}
                isFacilitator
                busy={busy}
                onAccept={onAccept}
                onNext={onNext}
            />
        );
        const { rerender } = renderWithProviders(table(true));
        const dialog = document.createElement('div');
        const button = document.createElement('button');

        dialog.setAttribute('role', 'dialog');
        dialog.append(button);
        document.body.append(dialog);

        rerender(table(false));
        await Promise.resolve();
        fireEvent.keyDown(button, { key: 'n' });
        fireEvent.keyDown(button, { key: 'Enter', ctrlKey: true });
        dialog.remove();

        expect(onNext).not.toHaveBeenCalled();
        expect(onAccept).not.toHaveBeenCalled();

        fireEvent.keyDown(document.body, { key: 'n' });
        fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('keeps the focus on the pressed action while busy and ignores further presses', () => {
        const onRevote = vi.fn();
        const onAccept = vi.fn();
        const onNext = vi.fn();
        const table = (busy: boolean) => (
            <PokerTable
                story={story}
                seats={seats}
                revealed
                result={dispersion}
                isFacilitator
                busy={busy}
                onRevote={onRevote}
                onAccept={onAccept}
                onNext={onNext}
            />
        );
        const { rerender } = renderWithProviders(table(false));

        for (const name of ['Re-vote', 'Save estimate', 'Next task']) {
            const action = screen.getByRole('button', {
                name,
            }) as HTMLButtonElement;

            action.focus();
            rerender(table(true));

            expect(action.disabled).toBe(false);
            expect(action.getAttribute('aria-disabled')).toBe('true');
            expect(document.activeElement).toBe(action);

            fireEvent.click(action);
            rerender(table(false));

            expect(action.getAttribute('aria-disabled')).toBeNull();
        }

        expect(onRevote).not.toHaveBeenCalled();
        expect(onAccept).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });

    it('keeps the focus on next task while busy before the reveal', () => {
        const onNext = vi.fn();
        const table = (busy: boolean) => (
            <PokerTable
                story={story}
                seats={[seat(0, 'voted', undefined, 'Camille')]}
                revealed={false}
                isFacilitator
                busy={busy}
                onNext={onNext}
            />
        );
        const { rerender } = renderWithProviders(table(false));
        const next = screen.getByRole('button', {
            name: 'Next task',
        }) as HTMLButtonElement;

        next.focus();
        rerender(table(true));
        fireEvent.click(next);

        expect(next.disabled).toBe(false);
        expect(document.activeElement).toBe(next);
        expect(onNext).not.toHaveBeenCalled();
    });

    it('keeps re-vote available on a consensus and prefers the saved estimate', () => {
        const onAccept = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: consensus,
            isFacilitator: true,
            estimate: '5',
            onRevote: vi.fn(),
            onAccept,
        });

        expect(screen.getAllByText('Consensus').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: 'Re-vote' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

        expect(onAccept).toHaveBeenCalledWith('5');
    });

    it('disables save without an estimate and next when there is no next task', () => {
        const onAccept = vi.fn();
        const onNext = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: { ...dispersion, nearestCard: null, mode: ['3', '5'] },
            isFacilitator: true,
            nextDisabled: true,
            onAccept,
            onNext,
        });

        expect(
            (
                screen.getByRole('button', {
                    name: 'Save estimate',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Next task',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
        fireEvent.keyDown(document, { key: 'n' });

        expect(onAccept).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });

    it('keeps the facilitator actions when the round is revealed without a result', () => {
        const onRevote = vi.fn();
        renderTable({
            seats,
            revealed: true,
            result: null,
            isFacilitator: true,
            onRevote,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));

        expect(onRevote).toHaveBeenCalledTimes(1);
    });

    it('hides facilitator actions from other participants', () => {
        renderTable({
            seats,
            revealed: true,
            result: dispersion,
            onRevote: vi.fn(),
            onAccept: vi.fn(),
        });

        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Save estimate' }),
        ).toBeNull();
    });

    it('follows a reveal coming from the server without remounting the seats', () => {
        const voting = [seat(0, 'voted', undefined, 'Camille')];
        const { rerender, container } = renderTable({ seats: voting });
        const seatElement = container.querySelector('[data-slot="poker-seat"]');

        rerender(
            <PokerTable
                story={story}
                seats={[seat(0, 'voted', '8', 'Camille')]}
                revealed
                result={consensus}
            />,
        );

        expect(container.querySelector('[data-slot="poker-seat"]')).toBe(
            seatElement,
        );
        expect(screen.getByRole('img', { name: 'Camille: 8' })).toBeTruthy();
    });
});

describe('suggestedEstimate', () => {
    it('takes the nearest card for numeric decks and the single mode otherwise', () => {
        expect(suggestedEstimate(dispersion, true)).toBe('8');
        expect(
            suggestedEstimate(
                { ...dispersion, nearestCard: null, mode: ['M'] },
                false,
            ),
        ).toBe('M');
        expect(
            suggestedEstimate(
                { ...dispersion, nearestCard: null, mode: ['M', 'L'] },
                false,
            ),
        ).toBeNull();
        expect(suggestedEstimate(null)).toBeNull();
    });
});

describe('PokerResultPanel alone', () => {
    it('renders a result without seats or actions', () => {
        renderWithProviders(
            <PokerResultPanel result={consensus} story={story} />,
        );

        expect(screen.getByRole('region', { name: 'Result' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
    });
});

describe('PokerTable layout and extreme data', () => {
    it('uses the oval up to 12 seats and a seat grid beyond', () => {
        const twelve = Array.from({ length: 12 }, (_, i) => seat(i, 'waiting'));
        const { container, unmount } = renderTable({ seats: twelve });

        expect(container.querySelector('[data-layout="oval"]')).not.toBeNull();
        expect(
            container.querySelector('[data-slot="poker-oval"]'),
        ).not.toBeNull();
        expect(
            container.querySelectorAll('[data-slot="poker-seat"]'),
        ).toHaveLength(12);
        unmount();

        const twenty = Array.from({ length: 20 }, (_, i) => seat(i, 'waiting'));
        const grid = renderTable({ seats: twenty });

        expect(
            grid.container.querySelector('[data-layout="grid"]'),
        ).not.toBeNull();
        expect(
            grid.container.querySelector('[data-slot="poker-oval"]'),
        ).toBeNull();
        expect(
            grid.container.querySelectorAll('[data-slot="poker-seat"]'),
        ).toHaveLength(20);
    });

    it('does not count watchers towards the 12 seats of the oval', () => {
        const seats = [
            ...Array.from({ length: 12 }, (_, i) => seat(i, 'waiting')),
            seat(12, 'watching'),
            seat(13, 'watching'),
        ];
        const { container } = renderTable({ seats });

        expect(container.querySelector('[data-layout="oval"]')).not.toBeNull();
    });

    it('renders an empty table, a 60-character name and a 20-value distribution', () => {
        const longName = 'N'.repeat(60);
        const values = Array.from({ length: 20 }, (_, i) =>
            `value-${i}`.slice(0, 8),
        );
        const { container, unmount } = renderTable({ seats: [] });

        expect(screen.getByRole('status').textContent).toBe('0 of 0 voted');
        unmount();

        renderTable({
            seats: [seat(0, 'voted', 'ABCDEFGH', longName)],
            revealed: true,
            result: {
                average: null,
                nearestCard: null,
                consensus: false,
                mode: [values[0]],
                distribution: values.map((value) => ({ value, count: 1 })),
            },
        });

        expect(
            screen.getByRole('img', { name: `${longName}: ABCDEFGH` }),
        ).toBeTruthy();
        expect(
            document.querySelectorAll('[data-slot="poker-dist-bar"]'),
        ).toHaveLength(20);
        expect(container).toBeTruthy();
    });
});
