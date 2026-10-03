import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigurationFieldDescription } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { SecretField } from './secret-field';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function description(
    overrides: Partial<ConfigurationFieldDescription> = {},
): ConfigurationFieldDescription {
    return {
        value: null,
        source: 'stored',
        secret: true,
        secretSet: true,
        unreadable: false,
        envName: 'OIDC_CLIENT_SECRET',
        ...overrides,
    };
}

function Harness({
    field,
    multiline = false,
}: {
    field: ConfigurationFieldDescription;
    multiline?: boolean;
}) {
    const [value, setValue] = useState('');
    const [clearing, setClearing] = useState(false);

    return (
        <SecretField
            name="client_secret"
            label="Client secret"
            description={field}
            value={value}
            onChange={setValue}
            clearing={clearing}
            onClearingChange={setClearing}
            multiline={multiline}
        />
    );
}

function input(): HTMLInputElement {
    return screen.getByLabelText('Client secret') as HTMLInputElement;
}

describe('SecretField', () => {
    it('shows a stored secret as placeholder dots only, never as a value', () => {
        renderWithProviders(<Harness field={description()} />);

        expect(input().value).toBe('');
        expect(input().type).toBe('password');
        expect(input().placeholder).toBe('••••••••••••••••••');
        expect(input().autocomplete).toBe('new-password');
        expect(
            screen.getByText('Saved. Leave blank to keep it.'),
        ).not.toBeNull();
    });

    it('names the environment variable of a secret set there', () => {
        renderWithProviders(
            <Harness field={description({ source: 'environment' })} />,
        );

        expect(
            screen.getByText(
                'From the environment (OIDC_CLIENT_SECRET). Type a value to save one here.',
            ),
        ).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Use the environment value' }),
        ).toBeNull();
    });

    it('has no placeholder and no help line when no secret is set', () => {
        renderWithProviders(
            <Harness
                field={description({ source: 'none', secretSet: false })}
            />,
        );

        expect(input().placeholder).toBe('');
        expect(screen.queryByText(/Leave blank/)).toBeNull();
        expect(screen.queryByText(/From the environment/)).toBeNull();
    });

    it('shows and hides what the admin typed, and is disabled while empty', () => {
        renderWithProviders(<Harness field={description()} />);

        const eye = screen.getByRole('button', {
            name: 'Show what you typed',
        }) as HTMLButtonElement;

        expect(eye.disabled).toBe(true);

        fireEvent.change(input(), { target: { value: 's3cret' } });

        expect(eye.disabled).toBe(false);
        expect(eye.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(eye);

        expect(input().type).toBe('text');
        expect(input().value).toBe('s3cret');

        const hide = screen.getByRole('button', {
            name: 'Hide what you typed',
        });

        expect(hide.getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(hide);

        expect(input().type).toBe('password');
    });

    it('warns about a saved secret that cannot be read any more', () => {
        renderWithProviders(
            <Harness
                field={description({
                    source: 'none',
                    secretSet: false,
                    unreadable: true,
                })}
            />,
        );

        expect(
            screen.getByText(
                "A saved secret can't be read any more (the application key changed). Enter it again.",
            ),
        ).not.toBeNull();
        expect(
            screen.getByRole('button', { name: 'Use the environment value' }),
        ).not.toBeNull();
    });

    it('offers to return a stored secret to the environment value', () => {
        renderWithProviders(<Harness field={description()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Use the environment value' }),
        );

        expect(
            screen.getByText('Back to the environment value when you save.'),
        ).not.toBeNull();
        expect(input().readOnly).toBe(true);
    });

    it('takes a pasted key in a text area without an eye', () => {
        renderWithProviders(<Harness field={description()} multiline />);

        const area = screen.getByLabelText('Client secret');

        expect(area.tagName).toBe('TEXTAREA');
        expect((area as HTMLTextAreaElement).value).toBe('');
        expect((area as HTMLTextAreaElement).placeholder).toBe(
            '••••••••••••••••••',
        );
        expect(
            screen.queryByRole('button', { name: 'Show what you typed' }),
        ).toBeNull();
    });
});
