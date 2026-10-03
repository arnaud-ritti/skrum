import type { CurrentTeam } from '@/types';

/**
 * Where "Team settings" leads, for the sidebar entry and for the gear of the
 * team page alike: the first tab of the team settings the viewer may open
 * (the server decides it), and nowhere when there is none.
 */
export function teamSettingsHref(
    currentTeam: Pick<CurrentTeam, 'settingsUrl'> | null | undefined,
): string | undefined {
    return currentTeam?.settingsUrl ?? undefined;
}
