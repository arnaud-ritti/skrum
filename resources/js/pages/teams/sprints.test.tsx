import { screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import TeamSprintsPage from './sprints';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: { translations: {}, locale: 'en', currentTeam: null },
    }),
    Head: () => null,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

type Props = ComponentProps<typeof TeamSprintsPage>;

const shell = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas', description: 'Product squad' },
    createdAt: '2025-03-10T09:00:00+00:00',
    sections: {
        general: true,
        sprints: true,
        retros: true,
        health: true,
        integrations: true,
        data: true,
        firstUrl: '/w/nordlys/teams/t1/settings',
    },
};

function currentSection(): string | null | undefined {
    return within(screen.getByRole('navigation', { name: 'Team settings' }))
        .getAllByRole('link')
        .find((link) => link.getAttribute('aria-current') === 'page')
        ?.textContent;
}

const props: Props = {
    ...shell,
    sprints: {
        list: [],
        total: 0,
        current: null,
        nextRetro: null,
        nextStart: {
            number: 1,
            startsOn: '2026-09-30',
            endsOn: '2026-10-13',
            refusal: null,
        },
        timeZone: 'UTC',
    },
    rituals: { sprintLengthWeeks: null, retroWeekday: null, retroTime: null },
};

describe('the Sprints section of the team settings', () => {
    it('shows the sprints card, and none of the retrospectives or of the health check', () => {
        renderWithProviders(<TeamSprintsPage {...props} />);

        expect(currentSection()).toBe('Sprints');
        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('Product squad · created in March 2025');
        expect(document.querySelector('section#sprints')).not.toBeNull();
        expect(document.querySelector('section#facilitators')).toBeNull();
        expect(document.querySelector('section#retro-templates')).toBeNull();
        expect(document.querySelector('section#default-columns')).toBeNull();
        expect(
            document.querySelector('[data-slot="health-statements"]'),
        ).toBeNull();
    });
});
