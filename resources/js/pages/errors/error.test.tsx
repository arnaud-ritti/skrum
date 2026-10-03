import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorStatusPage from '@/pages/errors/error';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    Head: () => null,
    usePage: () => page,
}));

function slot(name: string): Element | null {
    return document.querySelector(`[data-slot="${name}"]`);
}

const atlas = {
    team: { id: 'team-1', name: 'Atlas' },
    workspace: { name: 'Nordlys' },
    memberCount: 11,
    managers: [{ name: 'Camille Roux', avatarUrl: '' }],
    managersMore: 0,
    pending: false,
    storeUrl: '/w/nordlys/teams/team-1/access-requests',
};

describe('the error page', () => {
    beforeEach(() => {
        page.props = {
            translations: {},
            name: 'Nordlys',
            auth: { user: { email: 'nadia@nordlys.fr' } },
        };
    });

    it('links to the status of the instance', () => {
        renderWithProviders(
            <ErrorStatusPage status={404} statusUrl="/status" />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Instance status' })
                .getAttribute('href'),
        ).toBe('/status');
    });

    it('shows the version only when it is given', () => {
        const { rerender } = renderWithProviders(
            <ErrorStatusPage status={404} statusUrl="/status" />,
        );

        expect(slot('error-page-version')).toBeNull();

        rerender(
            <ErrorStatusPage
                status={404}
                statusUrl="/status"
                version="1.8.2"
            />,
        );

        expect(document.querySelector('footer')?.textContent).toBe(
            'Nordlys · v1.8.2',
        );
    });

    it('shows the version on a server error, without any shared prop', () => {
        page.props = { translations: {} };

        renderWithProviders(
            <ErrorStatusPage
                status={500}
                statusUrl="/status"
                requestId="0198c0de"
                version="1.8.2"
            />,
        );

        expect(document.querySelector('footer')?.textContent).toBe('v1.8.2');
        expect(
            screen.getByRole('link', { name: 'Instance status' }),
        ).toBeTruthy();
    });

    it('offers to ask for access to the team that refused the viewer', () => {
        renderWithProviders(
            <ErrorStatusPage
                status={403}
                statusUrl="/status"
                accessRequest={atlas}
            />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: "You don't have access to this team",
            }),
        ).toBeTruthy();
        expect(slot('error-page-access-request')?.textContent).toContain(
            'Atlas',
        );
        expect(
            screen.getByRole('button', { name: 'Request access' }),
        ).toBeTruthy();
    });

    it('keeps the plain refusal when no team is known', () => {
        renderWithProviders(
            <ErrorStatusPage status={403} statusUrl="/status" />,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: "You don't have access to this page",
            }),
        ).toBeTruthy();
        expect(slot('error-page-access-request')).toBeNull();
    });
});
