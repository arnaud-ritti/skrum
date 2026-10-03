import { describe, expect, it } from 'vitest';
import { managesRituals, takesPart, teamRoleLabel, teamRoles } from './roles';

const t = (key: string) => `«${key}»`;

describe('team roles', () => {
    it('labels each role', () => {
        expect(teamRoles.map((role) => teamRoleLabel(role, t))).toEqual([
            '«Owner»',
            '«Facilitator»',
            '«Member»',
            '«Observer»',
        ]);
    });

    it('lets everyone but an observer take part, a manager outside the team included', () => {
        expect(takesPart('observer')).toBe(false);
        expect(takesPart('member')).toBe(true);
        expect(takesPart(null)).toBe(true);
        expect(takesPart(undefined)).toBe(true);
    });

    it('gives the rituals to owners and facilitators', () => {
        expect(managesRituals('owner')).toBe(true);
        expect(managesRituals('facilitator')).toBe(true);
        expect(managesRituals('member')).toBe(false);
        expect(managesRituals('observer')).toBe(false);
        expect(managesRituals(null)).toBe(false);
    });
});
