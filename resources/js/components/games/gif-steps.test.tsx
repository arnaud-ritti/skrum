import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GifStepLine, GifSteps } from './gif-steps';

describe('GifSteps', () => {
    it('marks the step in play and the steps already done', () => {
        render(<GifSteps step={2} />);

        const steps = screen.getAllByRole('listitem');

        expect(steps.map((step) => step.textContent)).toEqual([
            'Pick a GIF',
            '2Reveal & vote',
            '3Winner',
        ]);
        expect(steps[0].hasAttribute('data-done')).toBe(true);
        expect(steps[1].getAttribute('aria-current')).toBe('step');
        expect(steps[2].hasAttribute('aria-current')).toBe(false);
        expect(steps[2].hasAttribute('data-done')).toBe(false);
    });

    it('has no step in play before the first round', () => {
        render(<GifSteps step={0} />);

        expect(
            screen
                .getAllByRole('listitem')
                .some((step) => step.hasAttribute('aria-current')),
        ).toBe(false);
    });
});

describe('GifStepLine', () => {
    it('names the step above the title of the game', () => {
        const { rerender } = render(<GifStepLine step={1} />);

        expect(screen.getByText('Step 1 of 3 · Pick a GIF')).toBeTruthy();

        rerender(<GifStepLine step={3} />);

        expect(screen.getByText('Step 3 of 3 · Results')).toBeTruthy();
    });
});
