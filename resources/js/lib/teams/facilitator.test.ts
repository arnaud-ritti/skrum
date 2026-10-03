import { describe, expect, it } from 'vitest';
import { facilitatorChoices, initialFacilitatorId } from './facilitator';

const options = [
    { id: 'ana', name: 'Ana', avatarUrl: '' },
    { id: 'bo', name: 'Bo', avatarUrl: '' },
    { id: 'cy', name: 'Cy', avatarUrl: '' },
];

describe('facilitator helpers', () => {
    it('keeps the suggestion while it is listed', () => {
        expect(initialFacilitatorId(options, 'bo', 'cy')).toBe('bo');
    });

    it('falls back on the viewer without a suggestion or when it is not listed', () => {
        expect(initialFacilitatorId(options, null, 'cy')).toBe('cy');
        expect(initialFacilitatorId(options, 'demoted', 'cy')).toBe('cy');
    });

    it('puts the viewer first and keeps the server order for the others', () => {
        expect(facilitatorChoices(options, 'bo').map(({ id }) => id)).toEqual([
            'bo',
            'ana',
            'cy',
        ]);
        expect(
            facilitatorChoices(options, 'nobody').map(({ id }) => id),
        ).toEqual(['ana', 'bo', 'cy']);
    });
});
