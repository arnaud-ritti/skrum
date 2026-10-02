import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ColorField } from './color-field';
import { ContrastBadge } from './contrast-badge';
import { PaletteWarnings } from './palette-warnings';
import { adjustedPalette, samplePalette } from './samples';

describe('ContrastBadge', () => {
    it.each([
        [7.2, 'AAA 7.2:1', 'AAA'],
        [5.8, 'AA 5.8:1', 'AA'],
        [3.1, 'Below AA 3.1:1', 'below'],
    ])('shows %s as "%s"', (ratio, text, level) => {
        renderWithProviders(<ContrastBadge ratio={ratio} />);

        const badge = screen
            .getByText(text)
            .closest('[data-slot=contrast-badge]');

        expect(badge).toHaveProperty('dataset.level', level);
    });
});

describe('PaletteWarnings', () => {
    it('translates each warning with its replacements', () => {
        renderWithProviders(
            <PaletteWarnings warnings={adjustedPalette.warnings} />,
        );

        expect(
            screen.getByText(
                'Too light to carry text: lightness adjusted from 88 % to 56 % in the light theme.',
            ),
        ).toBeTruthy();
    });

    it('renders nothing without a warning', () => {
        const { container } = renderWithProviders(
            <PaletteWarnings warnings={[]} />,
        );

        expect(container.firstChild).toBeNull();
    });
});

describe('ColorField', () => {
    it('shows the entered value next to the applied value of each theme', () => {
        const { container } = renderWithProviders(
            <ColorField
                value="FFD600"
                onChange={vi.fn()}
                defaultColor="#bb4d2a"
                palette={adjustedPalette}
            />,
        );
        const slot = (name: string): HTMLElement =>
            container.querySelector(`[data-slot=${name}]`) as HTMLElement;

        expect(slot('color-entered').textContent).toContain('#ffd600');
        expect(slot('color-applied-light').textContent).toContain('#8f7500');
        expect(slot('color-applied-light').textContent).toContain('AA 4.5:1');
        expect(slot('color-applied-dark').textContent).toContain('#e3c22b');
        expect(slot('color-applied-dark').textContent).toContain('AAA 9.8:1');
        expect(
            screen.getByText(/lightness adjusted from 88 % to 56 %/),
        ).toBeTruthy();
    });

    it('keeps the text field and the native picker in sync', () => {
        const onChange = vi.fn();
        const { container } = renderWithProviders(
            <ColorField
                value="#2B6"
                onChange={onChange}
                defaultColor="#bb4d2a"
                palette={samplePalette}
            />,
        );
        const picker = container.querySelector(
            '[data-slot=color-picker]',
        ) as HTMLInputElement;

        expect(picker.value).toBe('#22bb66');

        fireEvent.change(picker, { target: { value: '#112233' } });
        fireEvent.change(screen.getByLabelText('Primary colour'), {
            target: { value: 'abc' },
        });

        expect(onChange.mock.calls).toEqual([['#112233'], ['abc']]);
    });

    it('never paints a value that is not a colour and shows the error', () => {
        const { container } = renderWithProviders(
            <ColorField
                value="red;background:url(x)"
                onChange={vi.fn()}
                defaultColor="#bb4d2a"
                palette={samplePalette}
                error="Enter a hex colour."
            />,
        );
        const entered = container.querySelector(
            '[data-slot=color-entered]',
        ) as HTMLElement;

        expect(entered.textContent).toContain('Not a colour');
        expect(entered.querySelector('[style]')).toBeNull();
        expect(screen.getByText('Enter a hex colour.')).toBeTruthy();
        expect(
            container.querySelector('[data-slot=color-applied-light]')
                ?.textContent,
        ).toContain('#2b63b0');
    });

    it('names the Skrüm default when the field is empty', () => {
        const { container } = renderWithProviders(
            <ColorField
                value=""
                onChange={vi.fn()}
                defaultColor="#bb4d2a"
                palette={null}
            />,
        );

        expect(
            container.querySelector('[data-slot=color-entered]')?.textContent,
        ).toContain('Skrüm default#bb4d2a');
    });
});
