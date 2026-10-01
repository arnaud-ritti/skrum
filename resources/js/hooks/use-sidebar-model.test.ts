import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

type SharedProps = Record<string, unknown>;

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

const signedOut: SharedProps = {
    translations: {},
    auth: { user: null },
    currentWorkspace: null,
    currentTeam: null,
    teams: [],
    workspaces: [],
    actionItems: null,
};

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };
const team = { id: 't1', name: 'Atlas', membersCount: 8 };

function modelFor(props: SharedProps) {
    page.props = { ...signedOut, ...props };

    return renderHook(() => useSidebarModel()).result.current;
}

describe('useSidebarModel', () => {
    it('returns an empty model for a signed-out visitor', () => {
        const model = modelFor({});

        expect(model.team).toBeNull();
        expect(model.teams).toEqual([]);
        expect(model.workspace).toBeNull();
        expect(Object.keys(model.links)).toEqual([]);
    });

    it('offers the workspace links without team entries when no team is selected', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'member' },
            workspaces: [workspace],
        });

        expect(Object.keys(model.links).sort()).toEqual([
            'actions',
            'teams',
            'templates',
        ]);
    });

    it('offers the team links but no settings to a plain member', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'member' },
            currentTeam: team,
            teams: [{ id: 't1', name: 'Atlas' }],
            workspaces: [workspace],
        });

        expect(model.team?.initials).toBe('AT');
        expect(model.links.dashboard).toBeDefined();
        expect(model.links.sessions).toBeDefined();
        expect(model.links.mood).toBeDefined();
        expect(model.links.members).toBeDefined();
        expect(model.links.games).toBeDefined();
        expect(model.links.settings).toBeUndefined();
    });

    it('offers the team settings to a workspace owner', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'owner' },
            currentTeam: team,
            teams: [{ id: 't1', name: 'Atlas' }],
            workspaces: [workspace],
        });

        expect(model.links.settings).toBeDefined();
    });
});
