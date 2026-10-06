import { usePage } from '@inertiajs/react';
import TeamInsightsController from '@/actions/App/Http/Controllers/TeamInsightsController';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import TeamSessionsController from '@/actions/App/Http/Controllers/TeamSessionsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import type { AppSidebarProps, NavKey } from '@/components/skrum/app-sidebar';
import { firstLetter } from '@/lib/utils';
import { dashboard } from '@/routes';

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters =
        words.length > 1
            ? firstLetter(words[0]) + firstLetter(words[1])
            : Array.from(name.trim()).slice(0, 2).join('');

    return letters.toUpperCase();
}

/**
 * Home and the Sessions page carry the New session dialog: on one of them
 * the intent is added to the page the viewer is on, its query kept. Any
 * other page leads to Home.
 */
function newSessionHrefOn(url: string, home: string, sessions: string): string {
    const { pathname, searchParams } = new URL(url, 'http://localhost');

    if (pathname !== home && pathname !== sessions) {
        return `${home}?new=session`;
    }

    searchParams.set('new', 'session');

    return `${pathname}?${searchParams}`;
}

export function useSidebarModel(active?: NavKey): AppSidebarProps {
    const { url, props } = usePage();
    const {
        currentWorkspace,
        currentTeam,
        teams,
        workspaces,
        actionItems,
        liveSessions,
        brand,
        adminUrl,
    } = props;

    const links: AppSidebarProps['links'] = {};
    let newSessionHref: AppSidebarProps['newSessionHref'];

    if (currentWorkspace) {
        const slug = currentWorkspace.slug;

        links.actions = WorkspaceActionItemsController.index(
            slug,
            currentTeam ? { query: { team: currentTeam.id } } : undefined,
        );
        links.templates = WorkspaceTemplatesController.index(slug);
        links.teams = WorkspacesController.show(slug);

        if (currentTeam) {
            const team = { workspace: slug, team: currentTeam.id };

            const home = TeamsController.show(team);
            const sessions = TeamSessionsController.index(team);

            links.dashboard = home;
            links.sessions = sessions;
            links.insights = TeamInsightsController.show(team);
            links.members = TeamMembersController.index(team);

            if (currentTeam.settingsUrl !== null) {
                links.settings = currentTeam.settingsUrl;
            }

            if (currentTeam.canCreateSession) {
                newSessionHref = newSessionHrefOn(url, home.url, sessions.url);
            }
        }
    }

    if (adminUrl) {
        links.admin = adminUrl;
    }

    return {
        active,
        brand,
        team: currentTeam
            ? { ...currentTeam, initials: initialsOf(currentTeam.name) }
            : null,
        teams: currentWorkspace
            ? teams.map((team) => ({
                  ...team,
                  href: TeamsController.show({
                      workspace: currentWorkspace.slug,
                      team: team.id,
                  }),
              }))
            : [],
        workspace: currentWorkspace,
        workspaces: workspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            href: WorkspacesController.show(workspace.slug),
            teamsCount: workspace.teamsCount,
            role: workspace.role,
        })),
        newWorkspaceHref: WorkspacesController.create(),
        homeHref: dashboard(),
        links,
        overdueActions: actionItems?.overdueAssignedCount,
        liveSessions: liveSessions?.count ?? 0,
        newSessionHref,
    };
}
