import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RadiusControl } from './radius-control';

function Harness({
    initial,
    exact,
    onChange,
}: {
    initial: number;
    exact?: boolean;
    onChange?: (value: number) => void;
}) {
    const [value, setValue] = useState(initial);

    return (
        <RadiusControl
            value={value}
            exact={exact}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

function preset(name: string): HTMLElement {
    return screen.getByRole('radio', { name });
}

function checked(): string[] {
    return screen
        .getAllByRole('radio')
        .filter((item) => item.getAttribute('aria-checked') === 'true')
        .map((item) => item.textContent ?? '');
}

describe('RadiusControl', () => {
    it.each([
        ['Square', 0],
        ['Soft', 4],
        ['Standard', 8],
        ['Round', 16],
    ])('maps the segment %s to %i pixels', (name, pixels) => {
        const onChange = vi.fn();

        renderWithProviders(
            <Harness initial={pixels === 16 ? 0 : 16} onChange={onChange} />,
        );

        fireEvent.click(preset(name));

        expect(onChange).toHaveBeenCalledExactlyOnceWith(pixels);
        expect(checked()).toEqual([name]);
    });

    it('offers the four segments and no exact value field unless asked', () => {
        renderWithProviders(<Harness initial={8} />);

        expect(
            screen.getAllByRole('radio').map((item) => item.textContent),
        ).toEqual(['Square', 'Soft', 'Standard', 'Round']);
        expect(screen.queryByRole('spinbutton')).toBeNull();
    });

    it('shows Soft selected for a default value of 6 and does not write it', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness initial={6} onChange={onChange} />);

        expect(checked()).toEqual(['Soft']);

        fireEvent.click(preset('Soft'));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('shows the nearest segment for any default value', () => {
        const { unmount } = renderWithProviders(<Harness initial={10} />);

        expect(checked()).toEqual(['Standard']);

        unmount();
        renderWithProviders(<Harness initial={13} />);

        expect(checked()).toEqual(['Round']);
    });

    it('shows no segment selected and the exact value for a stored radius of 6', () => {
        renderWithProviders(<Harness initial={6} exact />);

        expect(checked()).toEqual([]);
        expect(
            (
                screen.getByRole('spinbutton', {
                    name: 'Exact radius in pixels',
                }) as HTMLInputElement
            ).value,
        ).toBe('6');
    });

    it('writes a typed exact value, kept between 0 and 16', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness initial={6} exact onChange={onChange} />);

        const field = screen.getByRole('spinbutton') as HTMLInputElement;

        fireEvent.change(field, { target: { value: '' } });

        expect(onChange).not.toHaveBeenCalled();
        expect(field.value).toBe('');

        fireEvent.change(field, { target: { value: '11' } });

        expect(onChange).toHaveBeenLastCalledWith(11);

        fireEvent.change(field, { target: { value: '40' } });

        expect(onChange).toHaveBeenLastCalledWith(16);

        fireEvent.blur(field);

        expect(field.value).toBe('16');
        expect(checked()).toEqual(['Round']);
    });

    it('keeps the exact field filled once a segment is chosen', () => {
        renderWithProviders(<Harness initial={6} exact />);

        fireEvent.click(preset('Soft'));

        expect(checked()).toEqual(['Soft']);
        expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe(
            '4',
        );
    });

    it('shows the server error', () => {
        renderWithProviders(
            <RadiusControl value={8} onChange={vi.fn()} error="Too round." />,
        );

        expect(screen.getByText('Too round.')).toBeTruthy();
    });
});
