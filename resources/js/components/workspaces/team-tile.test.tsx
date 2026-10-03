import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamTile, formatDaysAgo } from '@/components/workspaces/team-tile';
import { renderWithProviders } from '@/test/render';
import type { WorkspaceTeamTile } from '@/types';

const Now = Date.parse('2026-10-02T12:00:00Z');

const team: WorkspaceTeamTile = {
    id: 'team-1',
    name: 'Atlas',
    description: null,
    membersCount: 9,
    members: ['Arnaud Ritti', 'Camille Roux', 'Théo Martin', 'Inès Benali'].map(
        (name) => ({ name, avatarUrl: '' }),
    ),
    isMember: true,
    activity: {
        openRetroTitle: 'Sprint 42',
        lastRetroAt: '2026-09-18T10:00:00Z',
        openPokerGames: 3,
        openActionItems: 7,
        overdueActionItems: 2,
        openRetroSprint: null,
        whiteboardsEditedToday: 0,
    },
};

function tile(overrides: Partial<WorkspaceTeamTile> = {}) {
    renderWithProviders(
        <TeamTile
            team={{ ...team, ...overrides }}
            href="/w/nordlys/teams/team-1"
            locale="en"
            now={Now}
        />,
    );

    return screen.getByRole('link');
}

function line(slot: string): string | null | undefined {
    return document.querySelector(`[data-slot="${slot}"]`)?.textContent;
}

describe('formatDaysAgo', () => {
    it('tells a date to the day, the week, the month or the year', () => {
        expect(formatDaysAgo('2026-10-02T08:00:00Z', 'en', Now)).toBe('today');
        expect(formatDaysAgo('2026-10-01T10:00:00Z', 'en', Now)).toBe(
            'yesterday',
        );
        expect(formatDaysAgo('2026-09-29T10:00:00Z', 'en', Now)).toBe(
            '3 days ago',
        );
        expect(formatDaysAgo('2026-09-18T10:00:00Z', 'en', Now)).toBe(
            '2 weeks ago',
        );
        expect(formatDaysAgo('2026-07-01T10:00:00Z', 'en', Now)).toBe(
            '3 months ago',
        );
        expect(formatDaysAgo('2024-09-01T10:00:00Z', 'en', Now)).toBe(
            '2 years ago',
        );
    });

    it('follows the language of the user', () => {
        expect(formatDaysAgo('2026-09-29T10:00:00Z', 'fr', Now)).toBe(
            'il y a 3 jours',
        );
    });

    it('never tells a date in the future', () => {
        expect(formatDaysAgo('2026-10-05T10:00:00Z', 'en', Now)).toBe('today');
    });
});

describe('TeamTile', () => {
    it('is a link to the team, with its initial and its name', () => {
        const link = tile();

        expect(link.getAttribute('href')).toBe('/w/nordlys/teams/team-1');
        expect(link.querySelector('[data-slot="team-mark"]')?.textContent).toBe(
            'A',
        );
        expect(link.textContent).toContain('Atlas');
        expect(link.textContent).toContain('Open');
    });

    it('says the retro in progress, the active games and the open and late action items', () => {
        tile();

        expect(line('team-retro')).toBe('Retro in progress · Sprint 42');
        expect(line('team-poker')).toBe('3 active poker games');
        expect(line('team-actions')).toBe('7 open action items · 2 late');
    });

    it('says when the last retro ended when none is in progress', () => {
        tile({ activity: { ...team.activity, openRetroTitle: null } });

        expect(line('team-retro')).toBe('Last retro 2 weeks ago');
    });

    it('says so when the team has nothing going on', () => {
        tile({
            activity: {
                openRetroTitle: null,
                lastRetroAt: null,
                openPokerGames: 0,
                openActionItems: 0,
                overdueActionItems: 0,
                openRetroSprint: null,
                whiteboardsEditedToday: 0,
            },
        });

        expect(line('team-retro')).toBe('No retro yet');
        expect(line('team-poker')).toBe('No active game');
        expect(line('team-actions')).toBe('No open action items');
    });

    it('uses the singular for one game and one action item', () => {
        tile({
            activity: {
                ...team.activity,
                openPokerGames: 1,
                openActionItems: 1,
                overdueActionItems: 0,
                openRetroSprint: null,
                whiteboardsEditedToday: 0,
            },
        });

        expect(line('team-poker')).toBe('1 active poker game');
        expect(line('team-actions')).toBe('1 open action item');
    });

    it('stacks three members and counts the others next to the total', () => {
        tile();

        const members = document.querySelector('[data-slot="team-members"]');

        expect(
            members?.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(3);
        expect(
            members?.querySelector('[data-slot="avatar-stack-more"]')
                ?.textContent,
        ).toBe('+6');
        expect(members?.textContent).toContain('9 members');
    });

    it('shows no stack for a team without members', () => {
        tile({ membersCount: 0, members: [] });

        const members = document.querySelector('[data-slot="team-members"]');

        expect(members?.querySelector('[data-slot="avatar-stack"]')).toBeNull();
        expect(members?.textContent).toBe('0 members');
    });

    it('keeps a place for the description under the name', () => {
        renderWithProviders(
            <TeamTile
                team={team}
                href="/t"
                locale="en"
                now={Now}
                description={
                    <span data-testid="description">Product squad</span>
                }
            />,
        );

        expect(screen.getByTestId('description').textContent).toBe(
            'Product squad',
        );
    });
});
