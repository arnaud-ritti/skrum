import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RadiusControl } from './radius-control';

function Harness({ initial }: { initial: number }) {
    const [value, setValue] = useState(initial);

    return <RadiusControl value={value} onChange={setValue} />;
}

function exact(): HTMLInputElement {
    return screen.getByLabelText('Exact radius in pixels') as HTMLInputElement;
}

function preset(name: string): HTMLElement {
    return screen.getByRole('radio', { name });
}

describe('RadiusControl', () => {
    it('selects the preset that matches the value', () => {
        renderWithProviders(<Harness initial={10} />);

        expect(preset('Standard 10').getAttribute('aria-checked')).toBe('true');
        expect(exact().value).toBe('10');
    });

    it('writes a preset into the exact value', () => {
        renderWithProviders(<Harness initial={10} />);

        fireEvent.click(preset('Round 16'));

        expect(exact().value).toBe('16');
        expect(preset('Round 16').getAttribute('aria-checked')).toBe('true');
        expect(preset('Standard 10').getAttribute('aria-checked')).toBe(
            'false',
        );
    });

    it('selects a preset from the exact value, or none between presets', () => {
        renderWithProviders(<Harness initial={10} />);

        fireEvent.change(exact(), { target: { value: '6' } });

        expect(preset('Soft 6').getAttribute('aria-checked')).toBe('true');

        fireEvent.change(exact(), { target: { value: '7' } });

        expect(
            screen
                .getAllByRole('radio')
                .filter((item) => item.getAttribute('aria-checked') === 'true'),
        ).toHaveLength(0);
    });

    it('clamps the exact value to 0–16', () => {
        renderWithProviders(<Harness initial={10} />);

        fireEvent.change(exact(), { target: { value: '40' } });

        expect(exact().value).toBe('16');
        expect(preset('Round 16').getAttribute('aria-checked')).toBe('true');

        fireEvent.change(exact(), { target: { value: '-5' } });

        expect(exact().value).toBe('0');
        expect(preset('Square 0').getAttribute('aria-checked')).toBe('true');
    });
});
