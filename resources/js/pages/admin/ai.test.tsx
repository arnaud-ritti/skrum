import { router } from '@inertiajs/react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { ConfigurationFields } from '@/lib/admin/types';
import AdminAi from './ai';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
}));
vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({
        actions,
        children,
    }: {
        actions: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            {actions}
            {children}
        </div>
    ),
}));
afterEach(() => vi.restoreAllMocks());

function fields(): ConfigurationFields {
    return Object.fromEntries(
        ['provider', 'key', 'model', 'base_url'].map((name) => [
            name,
            {
                value:
                    name === 'provider'
                        ? 'openai'
                        : name === 'model'
                          ? 'test-model'
                          : null,
                source: 'stored',
                secret: name === 'key',
                secretSet: name === 'key',
                unreadable: false,
                envName: `SKRUM_LLM_${name.toUpperCase()}`,
            },
        ]),
    );
}

describe('AI settings', () => {
    it('saves a model change without resending the stored key', async () => {
        const put = vi.spyOn(router, 'put').mockImplementation(() => {});
        renderWithProviders(
            <AdminAi
                fields={fields()}
                configured
                confirmedUntil={new Date(Date.now() + 300000).toISOString()}
            />,
        );
        expect(
            (screen.getByLabelText('API key') as HTMLInputElement).value,
        ).toBe('');
        fireEvent.change(screen.getByLabelText('Model'), {
            target: { value: 'new-model' },
        });
        fireEvent.submit(screen.getByRole('form', { name: 'AI settings' }));
        await waitFor(() => expect(put).toHaveBeenCalled());
        expect(put.mock.calls[0][0]).toBe('/admin/ai');
        expect(put.mock.calls[0][1]).toEqual({ model: 'new-model' });
    });

    it('locks fields and links to confirmation when it expires', () => {
        renderWithProviders(
            <AdminAi fields={fields()} configured confirmedUntil={null} />,
        );
        expect(
            (screen.getByLabelText('Model') as HTMLInputElement).readOnly,
        ).toBe(true);
        expect(
            screen.getByRole('link', { name: /Confirm/ }).getAttribute('href'),
        ).toBe('/admin/ai/confirm');
    });
});
