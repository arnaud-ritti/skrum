import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

type SharedProps = Record<string, unknown>;

const page = vi.hoisted(() => ({
    url: '/',
    props: {} as Record<string, unknown>,
}));

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
    liveSessions: null,
    features: { mcp: false, integrations: false },
};

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };
const team = {
    id: 't1',
    name: 'Atlas',
    membersCount: 8,
    viewerRole: 'member',
    settingsUrl: null,
    canCreateSession: true,
};

const onTeam: SharedProps = {
    currentWorkspace: { ...workspace, role: 'member' },
    currentTeam: team,
    teams: [{ id: 't1', name: 'Atlas' }],
    workspaces: [workspace],
};

function modelFor(props: SharedProps, url = '/') {
    page.url = url;
    page.props = { ...signedOut, ...props };

    return renderHook(() => useSidebarModel()).result.current;
}

function hrefOf(link: unknown): string | undefined {
    if (typeof link === 'string' || link === undefined) {
        return link;
    }

    return (link as { url: string }).url;
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

    it('builds the team initials from whole characters', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'member' },
            currentTeam: { ...team, name: '🚀 Rocket' },
            teams: [{ id: 't1', name: '🚀 Rocket' }],
            workspaces: [workspace],
        });

        expect(model.team?.initials).toBe('🚀R');
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
        expect(hrefOf(model.links.sessions)).toBe(
            '/w/nordlys/teams/t1/sessions',
        );
        expect(hrefOf(model.links.insights)).toBe(
            '/w/nordlys/teams/t1/insights',
        );
        expect(hrefOf(model.links.members)).toBe('/w/nordlys/teams/t1/members');
        expect(model.links.settings).toBeUndefined();
    });

    it('links Actions to the current team', () => {
        expect(hrefOf(modelFor(onTeam).links.actions)).toBe(
            '/w/nordlys/action-items?team=t1',
        );
        expect(
            hrefOf(modelFor({ ...onTeam, currentTeam: null }).links.actions),
        ).toBe('/w/nordlys/action-items');
    });

    it('has no entry that leads to an anchor', () => {
        const model = modelFor({
            ...onTeam,
            currentTeam: {
                ...team,
                settingsUrl: '/w/nordlys/teams/t1/rituals',
            },
            adminUrl: '/admin',
        });
        const hrefs = [
            ...Object.values(model.links),
            model.newSessionHref,
            model.homeHref,
        ].map(hrefOf);

        expect(Object.keys(model.links).sort()).toEqual([
            'actions',
            'admin',
            'dashboard',
            'insights',
            'members',
            'sessions',
            'settings',
            'teams',
            'templates',
        ]);
        expect(hrefs.filter((href) => href?.includes('#'))).toEqual([]);
    });

    it('hands the number of live sessions to the sidebar, and none without the shared count', () => {
        expect(
            modelFor({ ...onTeam, liveSessions: { count: 2 } }).liveSessions,
        ).toBe(2);
        expect(modelFor(onTeam).liveSessions).toBe(0);
    });

    it('leads New session to Home with the intent, for who may create a session only', () => {
        expect(hrefOf(modelFor(onTeam).newSessionHref)).toBe(
            '/w/nordlys/teams/t1?new=session',
        );
        expect(
            modelFor({
                ...onTeam,
                currentTeam: { ...team, canCreateSession: false },
            }).newSessionHref,
        ).toBeUndefined();
        expect(
            modelFor({ ...onTeam, currentTeam: null }).newSessionHref,
        ).toBeUndefined();
    });

    it('opens New session on the Sessions page itself', () => {
        expect(
            hrefOf(
                modelFor(
                    onTeam,
                    '/w/nordlys/teams/t1/sessions?kind=retro&q=sprint',
                ).newSessionHref,
            ),
        ).toBe('/w/nordlys/teams/t1/sessions?kind=retro&q=sprint&new=session');
    });

    it('opens New session on Home itself', () => {
        expect(
            hrefOf(modelFor(onTeam, '/w/nordlys/teams/t1').newSessionHref),
        ).toBe('/w/nordlys/teams/t1?new=session');
    });

    it('opens New session on Home from any other page', () => {
        expect(
            hrefOf(
                modelFor(onTeam, '/w/nordlys/teams/t1/insights?range=90')
                    .newSessionHref,
            ),
        ).toBe('/w/nordlys/teams/t1?new=session');
        expect(
            hrefOf(
                modelFor(onTeam, '/w/nordlys/teams/t2/sessions').newSessionHref,
            ),
        ).toBe('/w/nordlys/teams/t1?new=session');
    });

    it('links to the admin area only when the server shares its URL', () => {
        expect(modelFor({ adminUrl: null }).links.admin).toBeUndefined();
        expect(modelFor({}).links.admin).toBeUndefined();
        expect(modelFor({ adminUrl: '/admin' }).links.admin).toBe('/admin');
    });

    it('hands the instance brand to the sidebar', () => {
        const brand = {
            name: 'Acme',
            logoLightUrl: '/brand/logo-light?v=1',
            logoDarkUrl: null,
            faviconUrl: null,
            poweredBy: true,
        };

        expect(modelFor({ brand }).brand).toEqual(brand);
    });

    it('leads "Settings" to the first section of the team settings the server gives', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'member' },
            currentTeam: {
                ...team,
                settingsUrl: '/w/nordlys/teams/t1/rituals',
            },
            teams: [{ id: 't1', name: 'Atlas' }],
            workspaces: [workspace],
        });

        expect(hrefOf(model.links.settings)).toBe(
            '/w/nordlys/teams/t1/rituals',
        );
    });

    it('hands the team count and the role of each workspace to the switcher', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'admin' },
            workspaces: [
                { ...workspace, teamsCount: 2, role: 'admin' },
                {
                    id: 'w2',
                    name: 'Kestrel Labs',
                    slug: 'kestrel-labs',
                    teamsCount: 1,
                    role: 'member',
                },
            ],
        });

        expect(
            model.workspaces.map(({ name, teamsCount, role }) => ({
                name,
                teamsCount,
                role,
            })),
        ).toEqual([
            { name: 'Nordlys', teamsCount: 2, role: 'admin' },
            { name: 'Kestrel Labs', teamsCount: 1, role: 'member' },
        ]);
    });

    it('still offers a new workspace to a user who has none', () => {
        const model = modelFor({ auth: { user: { id: 'u1' } } });

        expect(model.team).toBeNull();
        expect(model.workspace).toBeNull();
        expect(model.workspaces).toEqual([]);
        expect(hrefOf(model.newWorkspaceHref)).toBe('/workspaces/create');
    });
});
