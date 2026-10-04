import { describe, expect, it } from 'vitest';
import {
    isValidTeamSlug,
    slugFromName,
    TeamSlugMaxLength,
} from '@/lib/teams/team-slug';

describe('slugFromName', () => {
    it.each([
        ['Atlas', 'atlas'],
        ['  Équipe  Nord ', 'equipe-nord'],
        ['!!!', 'team'],
        ['A', 'team'],
        [
            'platform '.repeat(10),
            'platform-platform-platform-platform-platform',
        ],
    ])('gives the slug the server derives from %j', (name, slug) => {
        expect(slugFromName(name)).toBe(slug);
    });

    it('drops punctuation and joins words with one hyphen, as the server does', () => {
        expect(slugFromName("Ops' team / Paris_Nord")).toBe(
            'ops-team-paris-nord',
        );
    });

    it('never exceeds the longest slug', () => {
        expect(slugFromName('a'.repeat(80))).toHaveLength(TeamSlugMaxLength);
    });
});

describe('isValidTeamSlug', () => {
    it('accepts lower-case words joined by single hyphens', () => {
        expect(isValidTeamSlug('atlas')).toBe(true);
        expect(isValidTeamSlug('atlas-2')).toBe(true);
    });

    it('refuses capitals, double hyphens, edges, a single character and a long slug', () => {
        expect(isValidTeamSlug('Atlas')).toBe(false);
        expect(isValidTeamSlug('atlas--2')).toBe(false);
        expect(isValidTeamSlug('-atlas')).toBe(false);
        expect(isValidTeamSlug('a')).toBe(false);
        expect(isValidTeamSlug('a'.repeat(51))).toBe(false);
    });
});
