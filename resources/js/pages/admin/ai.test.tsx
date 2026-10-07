import { router } from '@inertiajs/react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.restoreAllMocks());

function fields(): ConfigurationFields {
    return Object.fromEntries(
        ['provider', 'key', 'model', 'base_url', 'bedrock_region'].map(
            (name) => [
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
            ],
        ),
    );
}

const providers = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'bedrock', label: 'Amazon Bedrock' },
    { value: 'ollama', label: 'Ollama' },
];

describe('AI settings', () => {
    it('saves a model change without resending the stored key', async () => {
        const put = vi.spyOn(router, 'put').mockImplementation(() => {});
        renderWithProviders(
            <AdminAi
                fields={fields()}
                providers={providers}
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
            <AdminAi
                fields={fields()}
                providers={providers}
                configured
                confirmedUntil={null}
            />,
        );
        expect(
            (screen.getByLabelText('Model') as HTMLInputElement).readOnly,
        ).toBe(true);
        expect(
            screen.getByRole('link', { name: /Confirm/ }).getAttribute('href'),
        ).toBe('/admin/ai/confirm');
    });
    it('offers providers and saves the selected provider', async () => {
        const put = vi.spyOn(router, 'put').mockImplementation(() => {});
        renderWithProviders(
            <AdminAi
                fields={fields()}
                providers={providers}
                configured
                confirmedUntil={new Date(Date.now() + 300000).toISOString()}
            />,
        );
        fireEvent.click(screen.getByRole('combobox', { name: 'Provider' }));
        fireEvent.click(await screen.findByRole('option', { name: 'Mistral' }));
        fireEvent.submit(screen.getByRole('form', { name: 'AI settings' }));
        await waitFor(() => expect(put).toHaveBeenCalled());
        expect(put.mock.calls[0][1]).toEqual({ provider: 'mistral' });
    });

    it('shows the AWS region when Bedrock is selected', async () => {
        renderWithProviders(
            <AdminAi
                fields={fields()}
                providers={providers}
                configured
                confirmedUntil={new Date(Date.now() + 300000).toISOString()}
            />,
        );
        expect(screen.queryByLabelText('AWS region')).toBeNull();
        fireEvent.click(screen.getByRole('combobox', { name: 'Provider' }));
        fireEvent.click(
            await screen.findByRole('option', { name: 'Amazon Bedrock' }),
        );
        expect(screen.getByLabelText('AWS region')).toBeTruthy();
        expect(screen.queryByLabelText('Azure API version')).toBeNull();
    });
});
