import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LockedSettingsCard } from './locked-settings-card';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

describe('LockedSettingsCard', () => {
    it('says what is kept back and leads to the password confirmation', () => {
        renderWithProviders(
            <LockedSettingsCard
                title="API tokens"
                description="Confirm your password to see, create and revoke your tokens."
                href="/settings/api-tokens"
            />,
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'API tokens' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Confirm your password to see, create and revoke your tokens.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('Locked')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Confirm password' })
                .getAttribute('href'),
        ).toBe('/settings/api-tokens');
    });
});
