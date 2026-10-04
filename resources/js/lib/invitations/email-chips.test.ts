import { describe, expect, it } from 'vitest';
import {
    addChips,
    isPlausibleAddress,
    MaxInvitationAddresses,
    removeChip,
    splitAddresses,
} from '@/lib/invitations/email-chips';

describe('email chips', () => {
    it('splits a pasted list on commas, semicolons, spaces and lines', () => {
        expect(splitAddresses('a@x.io, b@x.io;c@x.io\nd@x.io  e@x.io')).toEqual(
            ['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io', 'e@x.io'],
        );
    });

    it('marks an address without a dot after the at sign as incomplete', () => {
        expect(isPlausibleAddress('malik@nordlys')).toBe(false);
        expect(isPlausibleAddress('malik@nordlys.io')).toBe(true);
        expect(isPlausibleAddress('a@@b.io')).toBe(false);
    });

    it('keeps one chip per address, case and spaces ignored', () => {
        const chips = addChips([], 'Camille@Nordlys.io camille@nordlys.io ');

        expect(chips).toEqual([{ value: 'camille@nordlys.io', isValid: true }]);
    });

    it('stops at twenty addresses', () => {
        const many = Array.from({ length: 25 }, (_, i) => `p${i}@x.io`).join(
            ' ',
        );

        expect(addChips([], many)).toHaveLength(MaxInvitationAddresses);
    });

    it('removes a chip by its address', () => {
        expect(
            removeChip(addChips([], 'a@x.io b@x.io'), 'a@x.io').map(
                (chip) => chip.value,
            ),
        ).toEqual(['b@x.io']);
    });
});
