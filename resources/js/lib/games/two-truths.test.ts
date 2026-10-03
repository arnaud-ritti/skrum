import { describe, expect, it } from 'vitest';
import type { GamePlayer } from './types';
import { canSaveStatements, tellerOrder } from './two-truths';

function player(id: string): GamePlayer {
    return {
        id,
        presenceId: `p-${id}`,
        name: id,
        avatarUrl: '',
        isGuest: false,
        presence: 0,
    };
}

const players = ['ada', 'bob', 'cy', 'dee'].map(player);
const everyoneOnline = new Set(players.map((known) => known.presenceId));

describe('canSaveStatements', () => {
    it('needs three distinct statements and a lie', () => {
        expect(canSaveStatements(['I ski', 'I sing', 'I fly'], 2)).toBe(true);
        expect(canSaveStatements(['I ski', 'I sing', 'I fly'], null)).toBe(
            false,
        );
        expect(canSaveStatements(['I ski', 'I sing', '  '], 0)).toBe(false);
        expect(canSaveStatements(['I ski', 'i SKI ', 'I fly'], 0)).toBe(false);
        expect(canSaveStatements(['I ski', 'I sing', 'x'.repeat(121)], 0)).toBe(
            false,
        );
    });
});

describe('tellerOrder', () => {
    it('lists the ready players after the previous teller, online first', () => {
        const online = new Set(['p-ada', 'p-bob', 'p-dee']);

        expect(
            tellerOrder(players, online, ['ada', 'cy', 'dee'], 'bob', null),
        ).toEqual({ order: ['dee', 'ada', 'cy'], current: null, next: 'dee' });
    });

    it('puts the teller of the round in play first, then who tells next', () => {
        expect(
            tellerOrder(players, everyoneOnline, ['ada', 'dee'], null, 'cy'),
        ).toEqual({ order: ['cy', 'dee', 'ada'], current: 'cy', next: 'dee' });
    });

    it('has no next teller when no one has statements ready', () => {
        expect(tellerOrder(players, everyoneOnline, [], 'ada', 'ada')).toEqual({
            order: ['ada'],
            current: 'ada',
            next: null,
        });
    });
});
