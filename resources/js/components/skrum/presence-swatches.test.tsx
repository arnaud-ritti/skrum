import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PresenceSwatches } from '@/components/skrum/presence-swatches';
import { renderWithProviders } from '@/test/render';

function Controlled({
    initial,
    taken,
    name,
    onChange = () => {},
}: {
    initial: number | null;
    taken?: number[];
    name?: string;
    onChange?: (presence: number) => void;
}) {
    const [value, setValue] = useState(initial);

    return (
        <form data-testid="form">
            <PresenceSwatches
                value={value}
                taken={taken}
                name={name}
                label="Avatar colour"
                onChange={(presence) => {
                    setValue(presence);
                    onChange(presence);
                }}
            />
        </form>
    );
}

function checked(): string | null {
    return (
        screen
            .getAllByRole('radio')
            .find((radio) => radio.getAttribute('aria-checked') === 'true')
            ?.getAttribute('aria-label') ?? null
    );
}

describe('PresenceSwatches', () => {
    it('offers twelve colours in a named radio group', () => {
        renderWithProviders(<Controlled initial={4} />);

        expect(
            screen.getByRole('radiogroup', { name: 'Avatar colour' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(12);

        for (let number = 1; number <= 12; number++) {
            expect(
                screen.getByRole('radio', { name: `Colour ${number}` }),
            ).toBeTruthy();
        }

        expect(checked()).toBe('Colour 4');
        expect(
            screen
                .getByRole('radio', { name: 'Colour 4' })
                .getAttribute('tabindex'),
        ).toBe('0');
    });

    it('chooses a colour on click and reports it', () => {
        const onChange = vi.fn();

        renderWithProviders(<Controlled initial={1} onChange={onChange} />);

        fireEvent.click(screen.getByRole('radio', { name: 'Colour 7' }));

        expect(onChange).toHaveBeenCalledWith(7);
        expect(checked()).toBe('Colour 7');
    });

    it('skips taken colours with the arrow keys and wraps around', () => {
        renderWithProviders(<Controlled initial={11} taken={[12, 1]} />);

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Colour 11' }), {
            key: 'ArrowRight',
        });

        expect(checked()).toBe('Colour 2');
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Colour 2' }),
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Colour 2' }), {
            key: 'ArrowLeft',
        });

        expect(checked()).toBe('Colour 11');
    });

    it('marks a taken colour as disabled with the person icon', () => {
        renderWithProviders(<Controlled initial={1} taken={[3]} />);

        const taken = screen.getByRole('radio', { name: 'Colour 3 (taken)' });

        expect(taken.getAttribute('aria-disabled')).toBe('true');
        expect((taken as HTMLButtonElement).disabled).toBe(true);
        expect(
            taken.querySelector('[data-slot="presence-swatch-taken"]'),
        ).not.toBeNull();
        expect(
            screen
                .getByRole('radio', { name: 'Colour 1' })
                .querySelector('[data-slot="presence-swatch-taken"]'),
        ).toBeNull();
    });

    it('carries the value in a hidden input when named', () => {
        renderWithProviders(<Controlled initial={5} name="presence_color" />);

        const form = screen.getByTestId('form') as HTMLFormElement;

        expect(new FormData(form).get('presence_color')).toBe('5');

        fireEvent.click(screen.getByRole('radio', { name: 'Colour 9' }));

        expect(new FormData(form).get('presence_color')).toBe('9');
    });

    it('adds no input without a name', () => {
        renderWithProviders(<Controlled initial={5} />);

        const form = screen.getByTestId('form') as HTMLFormElement;

        expect([...new FormData(form).keys()]).toEqual([]);
    });

    it('keeps one swatch reachable by Tab when nothing is chosen', () => {
        renderWithProviders(<Controlled initial={null} taken={[1]} />);

        expect(checked()).toBeNull();
        expect(
            screen
                .getByRole('radio', { name: 'Colour 2' })
                .getAttribute('tabindex'),
        ).toBe('0');
    });
});
