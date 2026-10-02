import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { GifSettings } from './gif-settings';
import type { GifSettingsValue } from './gif-settings';

const base: GifSettingsValue = {
    provider: 'giphy',
    enabled: true,
    rating: 'g',
    key: '',
    keyClear: false,
};

function Harness({
    hasKey,
    onValue,
}: {
    hasKey: boolean;
    onValue: (value: GifSettingsValue) => void;
}) {
    const [value, setValue] = useState(base);

    return (
        <GifSettings
            hasKey={hasKey}
            value={value}
            onChange={(patch) => {
                const next = { ...value, ...patch };

                setValue(next);
                onValue(next);
            }}
        />
    );
}

function keyInputs(container: HTMLElement): HTMLInputElement[] {
    return Array.from(container.querySelectorAll('input[type=password]'));
}

describe('GifSettings key field', () => {
    it('shows no input and no key when a key is stored', () => {
        const { container } = renderWithProviders(
            <Harness hasKey onValue={vi.fn()} />,
        );

        expect(screen.getByText('A key is set')).toBeTruthy();
        expect(container.querySelectorAll('input')).toHaveLength(0);
    });

    it('reveals an empty password input on Replace', () => {
        const onValue = vi.fn();
        const { container } = renderWithProviders(
            <Harness hasKey onValue={onValue} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

        const [input] = keyInputs(container);

        expect(input.value).toBe('');
        expect(input.getAttribute('autocomplete')).toBe('off');
        expect(container.querySelector('input[type=text]')).toBeNull();

        fireEvent.change(input, { target: { value: 'typed-key' } });

        expect(onValue).toHaveBeenLastCalledWith({
            ...base,
            key: 'typed-key',
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Keep the current key' }),
        );

        expect(onValue).toHaveBeenLastCalledWith(base);
        expect(keyInputs(container)).toHaveLength(0);
        expect(screen.getByText('A key is set')).toBeTruthy();
    });

    it('marks the key for removal and lets the admin undo it', () => {
        const onValue = vi.fn();
        const { container } = renderWithProviders(
            <Harness hasKey onValue={onValue} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));

        expect(onValue).toHaveBeenLastCalledWith({ ...base, keyClear: true });
        expect(
            screen.getByText('The key is removed when you save.'),
        ).toBeTruthy();
        expect(keyInputs(container)).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Keep the key' }));

        expect(onValue).toHaveBeenLastCalledWith(base);
        expect(screen.getByText('A key is set')).toBeTruthy();
    });

    it('asks for a key directly when none is stored', () => {
        const { container } = renderWithProviders(
            <Harness hasKey={false} onValue={vi.fn()} />,
        );

        expect(keyInputs(container)).toHaveLength(1);
        expect(screen.queryByText('A key is set')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Remove key' })).toBeNull();
    });
});
