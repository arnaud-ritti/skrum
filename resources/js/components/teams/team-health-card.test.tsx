import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamHealthCard } from '@/components/teams/team-health-card';
import { renderWithProviders } from '@/test/render';
import type { TeamHealthStatement } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
    };
});

const statements: TeamHealthStatement[] = [
    {
        id: 'interaction',
        key: 'interaction',
        label: 'Interaction',
        text: 'Interaction with colleagues was productive',
        isBuiltin: true,
        isArchived: false,
    },
    {
        id: 'custom-1',
        key: 'custom-1',
        label: 'Delivery',
        text: 'We shipped what we promised',
        isBuiltin: false,
        isArchived: false,
    },
    {
        id: 'vision',
        key: 'vision',
        label: 'Vision',
        text: 'The vision and goals are clear to me',
        isBuiltin: true,
        isArchived: true,
    },
];

function card(canManage: boolean) {
    return renderWithProviders(
        <TeamHealthCard
            workspaceSlug="nordlys"
            teamId="team-1"
            statements={statements}
            canManage={canManage}
        />,
    );
}

describe('the health check card of a team', () => {
    it('lists the statements asked today, without the archived ones, and counts them', () => {
        card(true);

        const region = screen.getByRole('region', { name: 'Health check' });

        expect(
            within(region)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual([
            'InteractionBuilt-inInteraction with colleagues was productive',
            'DeliveryCustomWe shipped what we promised',
        ]);
        expect(
            within(region).getByText(
                '2 statements, scored 1–5, asked in every health check',
            ),
        ).toBeTruthy();
    });

    it('has no control on the statements: managing them is on the health check page', () => {
        card(true);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(
            screen.getByRole('link', { name: 'Manage' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/health-check');
    });

    it('leads a member who cannot manage to the same page under another word', () => {
        card(false);

        expect(screen.queryByRole('link', { name: 'Manage' })).toBeNull();
        expect(
            screen.getByRole('link', { name: 'Details' }).getAttribute('href'),
        ).toBe('/w/nordlys/teams/team-1/health-check');
    });
});
