import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import ShowInviteLink from './show';

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

describe('invite-links/show page', () => {
    it('does not invite to join the team when the link no longer works', () => {
        renderWithProviders(
            <ShowInviteLink
                isInvalid={false}
                isUsable={false}
                teamName="Atlas"
                workspaceName="Nordlys"
                inviter={null}
            />,
        );

        expect(screen.queryByText('Join Atlas')).toBeNull();
        expect(screen.getByText('This link no longer works.')).toBeTruthy();
    });
});
