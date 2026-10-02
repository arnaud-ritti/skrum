import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ROTIWidget } from '@/components/skrum/roti-widget';
import type { ROTIResult } from '@/components/skrum/roti-widget';

const result: ROTIResult = {
    mean: 3.8,
    votes: 11,
    distribution: { 1: 0, 2: 1, 3: 3, 4: 4, 5: 3 },
    previousMean: 3.4,
};

describe('ROTIWidget vote', () => {
    it('exposes the group and the five toggle buttons the board tests look for', () => {
        const { container } = render(<ROTIWidget mode="vote" />);
        const group = container.querySelector(
            '[role="group"][aria-label="How was this retro?"]',
        );

        expect(group).not.toBeNull();
        expect(
            [...group!.querySelectorAll('button')].map(
                (button) => button.textContent,
            ),
        ).toEqual([
            '1Time wasted',
            '2Not really worth it',
            '3Break-even',
            '4Good use of time',
            '5Excellent use of time',
        ]);
        expect(
            group!.querySelectorAll('button[aria-pressed="false"]'),
        ).toHaveLength(5);
        expect(group!.querySelector('button[aria-pressed="true"]')).toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('asks the question the old board asked, unless the host renames it', () => {
        const { rerender } = render(<ROTIWidget mode="vote" />);

        expect(
            screen.getByRole('group', { name: 'How was this retro?' }),
        ).toBeTruthy();

        rerender(
            <ROTIWidget
                mode="vote"
                labels={{ question: 'Worth your time?' }}
            />,
        );

        expect(
            screen.getByRole('group', { name: 'Worth your time?' }),
        ).toBeTruthy();
    });

    it('ignores a digit typed in a field portaled out of the group', () => {
        const onVote = vi.fn();
        render(<ROTIWidget mode="vote" onVote={onVote} />);

        fireEvent.keyDown(document.body, { key: '5' });

        expect(onVote).not.toHaveBeenCalled();
    });

    it('prevents the default of a digit so a global shortcut does not also fire', () => {
        render(<ROTIWidget mode="vote" onVote={vi.fn()} />);

        const notPrevented = fireEvent.keyDown(
            screen.getAllByRole('button')[0],
            {
                key: '3',
            },
        );

        expect(notPrevented).toBe(false);
    });

    it('votes on click, marks the score as pressed and shows the confirmation', () => {
        const onVote = vi.fn();
        const { rerender } = render(<ROTIWidget mode="vote" onVote={onVote} />);

        fireEvent.click(
            screen.getByRole('button', { name: /Good use of time/ }),
        );
        expect(onVote).toHaveBeenCalledWith(4);

        rerender(<ROTIWidget mode="vote" value={4} onVote={onVote} />);
        expect(
            screen
                .getAllByRole('button', { pressed: true })
                .map((button) => button.getAttribute('data-rating')),
        ).toEqual(['4']);
        expect(screen.getByRole('status').textContent).toContain(
            'Vote recorded',
        );
    });

    it('votes with keys 1 to 5 when the group is focused', () => {
        const onVote = vi.fn();
        render(<ROTIWidget mode="vote" onVote={onVote} />);

        fireEvent.keyDown(screen.getAllByRole('button')[0], { key: '5' });
        fireEvent.keyDown(screen.getAllByRole('button')[0], { key: '6' });

        expect(onVote).toHaveBeenCalledTimes(1);
        expect(onVote).toHaveBeenCalledWith(5);
    });

    it('moves the focus with arrows, wrapping around, without voting', () => {
        const onVote = vi.fn();
        render(<ROTIWidget mode="vote" value={5} onVote={onVote} />);
        const buttons = screen.getAllByRole('button');

        buttons[4].focus();
        fireEvent.keyDown(buttons[4], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(buttons[0]);

        fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(buttons[4]);

        fireEvent.keyDown(buttons[4], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(buttons[3]);
        expect(onVote).not.toHaveBeenCalled();
    });
});

describe('ROTIWidget result', () => {
    it('shows mean, trend, distribution counts and no names', () => {
        render(<ROTIWidget mode="result" result={result} />);

        expect(screen.getByText('3.8')).toBeTruthy();
        expect(screen.getByText('+0.4 vs previous sprint')).toBeTruthy();
        expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
            '4: 4',
        );
        expect(screen.queryByRole('group')).toBeNull();
    });

    it('shows the average for any count by default', () => {
        render(<ROTIWidget mode="result" result={{ ...result, votes: 1 }} />);

        expect(screen.getByText('3.8')).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows no average while nobody has voted', () => {
        render(
            <ROTIWidget
                mode="result"
                result={{
                    mean: null,
                    votes: 0,
                    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    previousMean: 3.4,
                }}
            />,
        );

        expect(screen.queryByText('/ 5')).toBeNull();
        expect(screen.queryByText(/vs previous sprint/)).toBeNull();
        expect(screen.getByRole('status').textContent).toBe(
            'Nobody has voted yet.',
        );
    });

    it('hides the result below the minimum the host asks for', () => {
        render(
            <ROTIWidget
                mode="result"
                minimumRespondents={3}
                result={{ ...result, votes: 2 }}
            />,
        );

        expect(screen.queryByText('3.8')).toBeNull();
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('status').textContent).toContain('3 people');
    });

    it('shows a negative trend', () => {
        render(
            <ROTIWidget
                mode="result"
                result={{ ...result, previousMean: 4.2 }}
            />,
        );

        expect(screen.getByText('−0.4 vs previous sprint')).toBeTruthy();
    });

    it('offers the close button only to a facilitator and calls onClose', () => {
        const onClose = vi.fn();
        const { rerender } = render(
            <ROTIWidget mode="result" result={result} onClose={onClose} />,
        );

        expect(screen.queryByRole('button')).toBeNull();

        rerender(
            <ROTIWidget
                mode="result"
                result={result}
                canClose
                onClose={onClose}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Close the ROTI' }));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('lists missing voters', () => {
        render(
            <ROTIWidget
                mode="result"
                result={{
                    ...result,
                    missing: [{ name: 'Hana G' }, { name: 'Guest' }],
                }}
            />,
        );

        expect(screen.getByText('2 participants have not voted')).toBeTruthy();
    });

    it('uses the singular for one vote and one missing participant', () => {
        render(
            <ROTIWidget
                mode="result"
                result={{
                    ...result,
                    votes: 1,
                    missing: [{ name: 'Hana G' }],
                }}
            />,
        );

        expect(screen.getByText('1 vote')).toBeTruthy();
        expect(screen.getByText('1 participant has not voted')).toBeTruthy();
    });
});
