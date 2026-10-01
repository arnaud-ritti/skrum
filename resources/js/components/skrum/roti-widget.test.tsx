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
    it('shows five labelled options in a radiogroup with none selected', () => {
        render(<ROTIWidget mode="vote" />);

        const group = screen.getByRole('radiogroup');

        expect(group.getAttribute('aria-labelledby')).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(5);
        expect(
            screen.getByRole('radio', { name: /Waste of time/ }),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('radio')
                .every((r) => r.getAttribute('aria-checked') === 'false'),
        ).toBe(true);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('votes on click and shows confirmation when a value is set', () => {
        const onVote = vi.fn();
        const { rerender } = render(<ROTIWidget mode="vote" onVote={onVote} />);

        fireEvent.click(screen.getByRole('radio', { name: /Useful/ }));
        expect(onVote).toHaveBeenCalledWith(4);

        rerender(<ROTIWidget mode="vote" value={4} onVote={onVote} />);
        expect(
            screen
                .getByRole('radio', { name: /Useful/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByRole('status').textContent).toContain(
            'Vote recorded',
        );
    });

    it('votes with keys 1 to 5 when the group is focused', () => {
        const onVote = vi.fn();
        render(<ROTIWidget mode="vote" onVote={onVote} />);

        fireEvent.keyDown(screen.getAllByRole('radio')[0], { key: '5' });
        fireEvent.keyDown(screen.getAllByRole('radio')[0], { key: '6' });

        expect(onVote).toHaveBeenCalledTimes(1);
        expect(onVote).toHaveBeenCalledWith(5);
    });

    it('moves with arrows, wrapping around', () => {
        const onVote = vi.fn();
        render(<ROTIWidget mode="vote" value={5} onVote={onVote} />);

        fireEvent.keyDown(screen.getByRole('radio', { name: /Excellent/ }), {
            key: 'ArrowRight',
        });
        expect(onVote).toHaveBeenLastCalledWith(1);

        fireEvent.keyDown(screen.getByRole('radio', { name: /Excellent/ }), {
            key: 'ArrowLeft',
        });
        expect(onVote).toHaveBeenLastCalledWith(4);
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
        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('hides the result below three respondents', () => {
        render(<ROTIWidget mode="result" result={{ ...result, votes: 2 }} />);

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
});
