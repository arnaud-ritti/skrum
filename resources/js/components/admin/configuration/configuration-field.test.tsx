import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigurationFieldDescription } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { ConfigurationField } from './configuration-field';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function description(
    overrides: Partial<ConfigurationFieldDescription> = {},
): ConfigurationFieldDescription {
    return {
        value: 'skrum-prod',
        source: 'stored',
        secret: false,
        secretSet: false,
        unreadable: false,
        envName: 'OIDC_CLIENT_ID',
        ...overrides,
    };
}

function Harness({
    field,
    readOnly = false,
    error,
}: {
    field: ConfigurationFieldDescription;
    readOnly?: boolean;
    error?: string;
}) {
    const [value, setValue] = useState(String(field.value ?? ''));
    const [clearing, setClearing] = useState(false);

    return (
        <ConfigurationField
            name="client_id"
            label="Client ID"
            description={field}
            value={value}
            onChange={setValue}
            clearing={clearing}
            onClearingChange={setClearing}
            readOnly={readOnly}
            error={error}
        />
    );
}

describe('ConfigurationField', () => {
    it('shows the value and says it is saved here', () => {
        renderWithProviders(<Harness field={description()} />);

        expect(
            (screen.getByLabelText('Client ID') as HTMLInputElement).value,
        ).toBe('skrum-prod');
        expect(screen.getByText('Saved here')).not.toBeNull();
    });

    it('names the environment variable a value comes from', () => {
        renderWithProviders(
            <Harness field={description({ source: 'environment' })} />,
        );

        expect(
            screen.getByText('From the environment (OIDC_CLIENT_ID)'),
        ).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Use the environment value' }),
        ).toBeNull();
    });

    it('says nothing about an empty field', () => {
        renderWithProviders(
            <Harness field={description({ source: 'none', value: null })} />,
        );

        expect(screen.queryByText('Saved here')).toBeNull();
        expect(screen.queryByText(/From the environment/)).toBeNull();
    });

    it('returns a stored field to the environment value on save, or keeps it on undo', () => {
        renderWithProviders(<Harness field={description()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Use the environment value' }),
        );

        expect(
            screen.getByText('Back to the environment value when you save.'),
        ).not.toBeNull();
        expect(
            (screen.getByLabelText('Client ID') as HTMLInputElement).readOnly,
        ).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(screen.getByText('Saved here')).not.toBeNull();
        expect(
            (screen.getByLabelText('Client ID') as HTMLInputElement).readOnly,
        ).toBe(false);
    });

    it('is read-only without a fresh confirmation', () => {
        renderWithProviders(<Harness field={description()} readOnly />);

        expect(
            (screen.getByLabelText('Client ID') as HTMLInputElement).readOnly,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Use the environment value',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('shows the error of the server under the field', () => {
        renderWithProviders(
            <Harness
                field={description()}
                error="This value is not accepted."
            />,
        );

        expect(screen.getByText('This value is not accepted.')).not.toBeNull();
        expect(
            screen.getByLabelText('Client ID').getAttribute('aria-invalid'),
        ).toBe('true');
    });
});
