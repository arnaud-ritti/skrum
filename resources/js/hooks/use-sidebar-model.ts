import { usePage } from '@inertiajs/react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import type { AppSidebarProps, NavKey } from '@/components/skrum/app-sidebar';
import { teamSettingsHref } from '@/lib/teams/settings-href';
import { dashboard } from '@/routes';

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/);
    const letters =
        words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);

    return letters.toUpperCase();
}

export function useSidebarModel(active?: NavKey): AppSidebarProps {
    const {
        currentWorkspace,
        currentTeam,
        teams,
        workspaces,
        actionItems,
        brand,
        adminUrl,
        features,
    } = usePage().props;

    const links: AppSidebarProps['links'] = {};

    if (currentWorkspace) {
        const slug = currentWorkspace.slug;

        links.actions = WorkspaceActionItemsController.index(slug);
        links.templates = WorkspaceTemplatesController.index(slug);
        links.teams = WorkspacesController.show(slug);

        if (currentTeam) {
            const team = { workspace: slug, team: currentTeam.id };
            const teamUrl = TeamsController.show.url(team);

            links.dashboard = teamUrl;
            links.sessions = `${teamUrl}#sessions`;
            links.mood = `${teamUrl}#mood`;
            links.members = `${teamUrl}#members`;
            links.games = TeamGameRoomsController.index(team);

            const settings = teamSettingsHref({
                ...team,
                canManage: currentWorkspace.role !== 'member',
                hasIntegrationsPage: features?.integrations === true,
            });

            if (settings !== undefined) {
                links.settings = settings;
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
    };
}
