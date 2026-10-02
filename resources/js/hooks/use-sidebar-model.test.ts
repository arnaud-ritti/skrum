import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { teamSettingsHref } from '@/components/teams/team-page';
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
    features: { mcp: false, integrations: false },
};

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };
const team = { id: 't1', name: 'Atlas', membersCount: 8 };

function modelFor(props: SharedProps) {
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

    it('links to the admin area only when the server shares its URL', () => {
        expect(modelFor({ adminUrl: null }).links.admin).toBeUndefined();
        expect(modelFor({}).links.admin).toBeUndefined();
        expect(modelFor({ adminUrl: '/admin/branding' }).links.admin).toBe(
            '/admin/branding',
        );
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

    it('leads a workspace owner to the integrations of the team when a provider is configured', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'owner' },
            currentTeam: team,
            teams: [{ id: 't1', name: 'Atlas' }],
            workspaces: [workspace],
            features: { mcp: false, integrations: true },
        });

        expect(hrefOf(model.links.settings)).toBe(
            '/w/nordlys/teams/t1/integrations',
        );
    });

    it('leads a workspace owner to the settings card of the team page when no provider is configured', () => {
        const model = modelFor({
            currentWorkspace: { ...workspace, role: 'owner' },
            currentTeam: team,
            teams: [{ id: 't1', name: 'Atlas' }],
            workspaces: [workspace],
            features: { mcp: false, integrations: false },
        });

        expect(hrefOf(model.links.settings)).toBe(
            '/w/nordlys/teams/t1#settings',
        );
    });

    it.each([
        { role: 'owner', integrations: true },
        { role: 'owner', integrations: false },
        { role: 'admin', integrations: true },
        { role: 'member', integrations: true },
        { role: 'member', integrations: false },
    ])(
        'leads a $role where the gear of the team page leads (provider configured: $integrations)',
        ({ role, integrations }) => {
            const model = modelFor({
                currentWorkspace: { ...workspace, role },
                currentTeam: team,
                teams: [{ id: 't1', name: 'Atlas' }],
                workspaces: [workspace],
                features: { mcp: false, integrations },
            });
            const manages = role !== 'member';

            expect(hrefOf(model.links.settings)).toBe(
                teamSettingsHref({
                    workspace,
                    team: team as never,
                    canManage: manages,
                    canManageIntegrations: manages && integrations,
                }),
            );
        },
    );
});
