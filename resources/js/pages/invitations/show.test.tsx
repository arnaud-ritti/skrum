import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import ShowInvitation from './show';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            translations: {},
            locale: 'en',
            locales: ['en'],
            errors: {},
            auth: { user: null },
            brand: {
                name: 'Skrüm',
                logoLightUrl: null,
                logoDarkUrl: null,
                faviconUrl: null,
                poweredBy: true,
            },
        },
    }),
    Head: () => null,
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

describe('invitations/show page', () => {
    it.each([
        ['expired', { isExpired: true }],
        ['declined', { isDeclined: true }],
    ])(
        'does not invite to join the workspace when the invitation is %s',
        (_state, flags) => {
            renderWithProviders(
                <ShowInvitation
                    isInvalid={false}
                    workspaceName="Atlas"
                    inviter={null}
                    {...flags}
                />,
            );

            expect(screen.queryByText('Join Atlas')).toBeNull();
            expect(
                screen.getAllByRole('heading', { name: 'Invitation' }).length,
            ).toBeGreaterThan(0);
        },
    );
});
