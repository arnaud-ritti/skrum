import { usePage } from '@inertiajs/react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
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

export function useSidebarModel(active?: NavKey): AppSidebarProps {
    const {
        currentWorkspace,
        currentTeam,
        teams,
        workspaces,
        actionItems,
        brand,
        adminUrl,
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
            links.sessions = TeamSessionsController.index(team);
            links.mood = `${teamUrl}#mood`;
            links.members = `${teamUrl}#members`;
            links.games = TeamGameRoomsController.index(team);

            if (currentTeam.settingsUrl !== null) {
                links.settings = currentTeam.settingsUrl;
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
