import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PokerResultBar } from '@/components/skrum/poker-result-bar';
import type { PokerResultBarProps } from '@/components/skrum/poker-result-bar';
import type { PokerResult, PokerSeat } from '@/components/skrum/poker-table';
import { renderWithProviders } from '@/test/render';

const story = { key: 'ATLAS-1290', title: 'Export CSV' };

const split: PokerResult = {
    average: 5.25,
    median: 5,
    spread: { min: 3, max: 8 },
    agreement: 0.5,
    outliers: { low: ['lucas'], high: ['malik'] },
    mode: ['5'],
    consensus: false,
    nearestCard: '5',
    distribution: [
        { value: '3', count: 1 },
        { value: '5', count: 2 },
        { value: '8', count: 1 },
    ],
};

const seats: PokerSeat[] = [
    { user: { id: 'camille', name: 'Camille' }, state: 'voted', value: '5' },
    { user: { id: 'malik', name: 'Malik' }, state: 'voted', value: '8' },
    { user: { id: 'lucas', name: 'Lucas' }, state: 'voted', value: '3' },
    { user: { id: 'sofia', name: 'Sofia' }, state: 'voted', value: '5' },
];

const deck = ['1', '2', '3', '5', '8', '13'];

function renderBar(props: Partial<PokerResultBarProps> = {}) {
    return renderWithProviders(
        <PokerResultBar
            result={split}
            seats={seats}
            story={story}
            headingId="poker-result"
            {...props}
        />,
    );
}

function facilitator(
    props: Partial<PokerResultBarProps> = {},
): Partial<PokerResultBarProps> {
    return {
        isFacilitator: true,
        estimate: '5',
        estimateValues: deck,
        onEstimateChange: vi.fn(),
        onValidate: vi.fn(),
        onRevote: vi.fn(),
        ...props,
    };
}

describe('PokerResultBar, what everyone reads', () => {
    it('is a section named by its heading, which counts the votes and can take focus', () => {
        const { container } = renderBar();
        const section = screen.getByRole('region', {
            name: 'Result · 4 votes',
        });

        expect(section.getAttribute('data-slot')).toBe('poker-result');
        expect(section.getAttribute('tabindex')).toBe('-1');
        expect(
            container
                .querySelector('[aria-labelledby="poker-result"] h3')
                ?.getAttribute('id'),
        ).toBe('poker-result');
    });

    it('shows the agreement, the distribution and who opens the discussion, and leaves the average to the oval', () => {
        const { container } = renderBar();
        const stats = Array.from(container.querySelectorAll('dl > div')).map(
            (stat) =>
                `${stat.querySelector('dt')?.textContent}=${stat.querySelector('dd')?.textContent}`,
        );
        const rows = Array.from(container.querySelectorAll('li')).map((row) => {
            const spans = row.querySelectorAll('span');

            return `${spans[0].textContent} x${spans[2].textContent}`;
        });

        expect(stats).toEqual(['Agreement=50 % on 5']);
        expect(rows).toEqual(['3 x1', '5 x2', '8 x1']);
        expect(
            screen.getByText('Lucas (3) and Malik (8) open the discussion.'),
        ).toBeTruthy();
        expect(screen.queryByText('Average')).toBeNull();
        expect(screen.queryByText('Median')).toBeNull();
    });

    it('names nobody on an anonymous round', () => {
        renderBar({ anonymous: true });

        expect(screen.queryByText(/Lucas/)).toBeNull();
        expect(
            screen.getByText(
                'The lowest and the highest estimates open the discussion.',
            ),
        ).toBeTruthy();
    });

    it('says why the cards were revealed, and shows the status it is given', () => {
        const { rerender } = renderBar({
            revealReason: 'everyone_voted',
            status: <span>Your card · 5</span>,
        });

        expect(
            screen.getByText('Revealed automatically — everyone voted'),
        ).toBeTruthy();
        expect(screen.getByText('Your card · 5')).toBeTruthy();

        rerender(
            <PokerResultBar
                result={split}
                story={story}
                revealReason="timer"
            />,
        );

        expect(
            screen.getByText("Revealed automatically — time's up"),
        ).toBeTruthy();
    });

    it('names the nearest card of a numeric deck', () => {
        const { rerender } = renderBar();

        expect(screen.getByText('Nearest card: 5')).toBeTruthy();

        rerender(
            <PokerResultBar result={split} story={story} isNumeric={false} />,
        );

        expect(screen.queryByText(/Nearest card/)).toBeNull();
    });

    it('says when no vote can be counted', () => {
        renderBar({
            result: {
                average: null,
                mode: [],
                consensus: false,
                nearestCard: null,
                distribution: [{ value: '?', count: 2 }],
            },
        });

        expect(screen.getByText('No countable votes')).toBeTruthy();
        expect(screen.queryByText('Agreement')).toBeNull();
    });

    it('has no facilitator tool for a participant', () => {
        renderBar({ ...facilitator(), isFacilitator: false });

        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
    });
});

describe('PokerResultBar, the facilitator', () => {
    it('offers the cards of the deck as the final estimate, the given one chosen', () => {
        const onEstimateChange = vi.fn();
        renderBar(facilitator({ onEstimateChange }));
        const cards = screen.getByRole('radiogroup', {
            name: 'Final estimate',
        });

        expect(
            within(cards)
                .getAllByRole('radio')
                .map(
                    (card) =>
                        `${card.getAttribute('aria-label')}:${card.getAttribute('aria-checked')}`,
                ),
        ).toEqual([
            '1:false',
            '2:false',
            '3:false',
            '5:true',
            '8:false',
            '13:false',
        ]);

        fireEvent.click(within(cards).getByRole('radio', { name: '8' }));

        expect(onEstimateChange).toHaveBeenCalledWith('8');
    });

    it('validates the chosen estimate with one button, which names the next story when there is one', () => {
        const onValidate = vi.fn();
        const { rerender } = renderBar(
            facilitator({ onValidate, hasNext: true }),
        );
        const tools = screen.getByRole('group', { name: 'Facilitator tools' });

        expect(
            within(tools)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Validate 5 · Next story', 'Re-vote']);

        fireEvent.click(
            screen.getByRole('button', { name: 'Validate 5 · Next story' }),
        );

        expect(onValidate).toHaveBeenCalledWith('5');

        rerender(
            <PokerResultBar
                result={split}
                story={story}
                {...facilitator({ onValidate, estimate: '8' })}
            />,
        );

        expect(screen.getByRole('button', { name: 'Validate 8' })).toBeTruthy();
    });

    it('cannot validate without an estimate, and says why', () => {
        const onValidate = vi.fn();
        renderBar(facilitator({ onValidate, estimate: '' }));
        const validate = screen.getByRole('button', { name: /^Validate/ });

        expect(validate).toHaveProperty('disabled', true);
        expect(
            document.getElementById(
                validate.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Choose an estimate first.');
        expect(
            screen
                .getAllByRole('radio')
                .every((card) => card.getAttribute('aria-checked') === 'false'),
        ).toBe(true);
    });

    it('re-votes', () => {
        const onRevote = vi.fn();
        renderBar(facilitator({ onRevote }));

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));

        expect(onRevote).toHaveBeenCalledTimes(1);
    });

    it('keeps the focus on a pressed action while busy and ignores further presses', () => {
        const onValidate = vi.fn();
        const onRevote = vi.fn();
        renderBar(facilitator({ onValidate, onRevote, busy: true }));
        const validate = screen.getByRole('button', { name: 'Validate 5' });

        expect(validate).toHaveProperty('disabled', false);
        expect(validate.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(validate);
        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));

        expect(onValidate).not.toHaveBeenCalled();
        expect(onRevote).not.toHaveBeenCalled();
    });

    it('keeps the tools when the round is revealed without a result', () => {
        renderBar(facilitator({ result: null }));

        expect(
            screen.getByRole('region', { name: 'Votes revealed' }),
        ).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Re-vote' })).toBeTruthy();
    });

    it('on a phone, puts the result and the final-estimate cards in a card, and the two buttons in the foot', () => {
        const onRevote = vi.fn();
        const { container, rerender } = renderBar(
            facilitator({ layout: 'card' }),
        );

        expect(
            container
                .querySelector('[data-slot="poker-result"]')
                ?.getAttribute('data-layout'),
        ).toBe('card');
        expect(screen.getByText('50 % on 5')).toBeTruthy();
        expect(
            screen.getByRole('radiogroup', { name: 'Final estimate' }),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Validate/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();

        rerender(
            <PokerResultBar
                result={split}
                story={story}
                {...facilitator({ layout: 'foot', hasNext: true, onRevote })}
            />,
        );

        expect(
            container.querySelector('[data-slot="poker-result"]'),
        ).toBeNull();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Validate 5 · Next story' }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));

        expect(onRevote).toHaveBeenCalledTimes(1);
    });

    it('has no foot for a participant', () => {
        const { container } = renderBar({ layout: 'foot' });

        expect(container.firstChild).toBeNull();
    });
});
