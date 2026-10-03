import { describe, expect, it } from 'vitest';
import { teamSettingsHref } from './settings-href';

const team = { id: 't1', name: 'Atlas', membersCount: 4, viewerRole: null };

describe('teamSettingsHref', () => {
    it('leads to the first tab of the team settings the viewer may open', () => {
        expect(
            teamSettingsHref({
                ...team,
                settingsUrl: '/w/nordlys/teams/t1/members',
            }),
        ).toBe('/w/nordlys/teams/t1/members');
    });

    it('leads nowhere when no tab is open to the viewer or without a team', () => {
        expect(
            teamSettingsHref({ ...team, settingsUrl: null }),
        ).toBeUndefined();
        expect(teamSettingsHref(null)).toBeUndefined();
        expect(teamSettingsHref(undefined)).toBeUndefined();
    });
});
