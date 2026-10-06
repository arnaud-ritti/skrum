import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    RotiOutcome,
    RotiValue,
    rotiStep,
} from '@/components/skrum/roti-value';

const value = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-slot="roti-value"]');

describe('rotiStep', () => {
    it('rounds an average to its step: 3.5 is 4, 3.4 is 3', () => {
        expect(rotiStep(3.5)).toBe(4);
        expect(rotiStep(3.4)).toBe(3);
    });

    it('clamps below 1 and above 5', () => {
        expect(rotiStep(0.2)).toBe(1);
        expect(rotiStep(5.4)).toBe(5);
    });
});

describe('RotiValue', () => {
    it('renders the value with one decimal in the class of its step', () => {
        const { container } = render(
            <RotiValue value={4} className="text-3xl" />,
        );
        const drawn = value(container);

        expect(drawn?.textContent).toBe('4.0');
        expect(drawn?.getAttribute('data-step')).toBe('4');
        expect(drawn?.classList.contains('bg-skrum-roti-4')).toBe(true);
        expect(drawn?.classList.contains('text-skrum-roti-foreground')).toBe(
            true,
        );
        expect(drawn?.classList.contains('text-3xl')).toBe(true);
    });

    it('takes the colour of the step an average rounds to', () => {
        const { container } = render(<RotiValue value={1.5} />);

        expect(value(container)?.textContent).toBe('1.5');
        expect(value(container)?.classList.contains('bg-skrum-roti-2')).toBe(
            true,
        );
    });
});

describe('RotiOutcome', () => {
    it('keeps the word ROTI as text before the value, then what follows it', () => {
        const { container, rerender } = render(
            <RotiOutcome value={4} rest="2 actions" />,
        );

        expect(container.textContent).toBe('ROTI 4.0 · 2 actions');
        expect(value(container)?.getAttribute('data-step')).toBe('4');

        rerender(<RotiOutcome value={2} />);

        expect(container.textContent).toBe('ROTI 2.0');
        expect(value(container)?.getAttribute('data-step')).toBe('2');
    });

    it('separates the word from the value with the gap of a label and its badge', () => {
        const { container } = render(
            <RotiOutcome value={4} rest="2 actions" />,
        );
        const pair = value(container)?.parentElement;

        expect(pair?.textContent).toBe('ROTI 4.0');
        expect(pair?.classList.contains('inline-flex')).toBe(true);
        expect(pair?.classList.contains('gap-1.5')).toBe(true);
    });
});
