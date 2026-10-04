import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamTile } from '@/components/workspaces/team-tile';
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

    it('shows the description of the team under its name', () => {
        tile({ description: 'Product squad · retro app' });

        expect(line('team-description')).toBe('Product squad · retro app');
    });

    it('shows nothing under the name without a description', () => {
        tile();

        expect(line('team-description')).toBeUndefined();
    });

    it('names the sprint of the retro in progress in place of its title', () => {
        tile({
            activity: {
                ...team.activity,
                openRetroTitle: 'Atlas retro',
                openRetroSprint: 42,
            },
        });

        expect(line('team-retro')).toBe('Retro in progress · Sprint 42');
    });

    it('says how many whiteboards were edited today when no game is active', () => {
        tile({
            activity: {
                ...team.activity,
                openPokerGames: 0,
                whiteboardsEditedToday: 3,
            },
        });

        expect(line('team-poker')).toBeUndefined();
        expect(line('team-whiteboards')).toBe('3 whiteboards edited today');
    });

    it('uses the singular for one whiteboard edited today', () => {
        tile({
            activity: {
                ...team.activity,
                openPokerGames: 0,
                whiteboardsEditedToday: 1,
            },
        });

        expect(line('team-whiteboards')).toBe('1 whiteboard edited today');
    });

    it('prefers the active poker games to the whiteboards', () => {
        tile({
            activity: {
                ...team.activity,
                openPokerGames: 2,
                whiteboardsEditedToday: 3,
            },
        });

        expect(line('team-poker')).toBe('2 active poker games');
        expect(line('team-whiteboards')).toBeUndefined();
    });
});
