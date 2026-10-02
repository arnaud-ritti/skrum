import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';

type TeamSettingsScope = {
    workspace: string;
    team: string;
    /** The viewer can change the settings of the team. */
    canManage: boolean;
    /** The integrations page exists: a provider is configured. */
    hasIntegrationsPage: boolean;
};

/**
 * Where "Team settings" leads, for the sidebar entry and for the gear of the
 * team page alike: the integrations page while a provider is configured (it
 * answers 404 otherwise), the settings card of the team page if not, and
 * nowhere for who cannot manage the team.
 */
export function teamSettingsHref({
    workspace,
    team,
    canManage,
    hasIntegrationsPage,
}: TeamSettingsScope): string | undefined {
    if (!canManage) {
        return undefined;
    }

    if (hasIntegrationsPage) {
        return TeamIntegrationsController.index.url({ workspace, team });
    }

    return `${TeamsController.show.url({ workspace, team })}#settings`;
}
