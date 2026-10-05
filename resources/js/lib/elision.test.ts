import { describe, expect, it } from 'vitest';
import { elide } from '@/lib/elision';

describe('elide', () => {
    it.each([
        ['Tour de :name', "Tour d':name"],
        ['Plus que :name', "Plus qu':name"],
        ['Voir le :name', "Voir l':name"],
        ['Voir la :name', "Voir l':name"],
        ['De :name à toi', "D':name à toi"],
        ['Attends jusque :name', "Attends jusqu':name"],
    ])('elides "%s" before a vowel', (line, expected) => {
        expect(elide(line, { name: 'Inès' })).toBe(expected);
    });

    it.each(['Élodie', 'Œdipe', 'arnaud', 'Ulysse'])(
        'elides before %s',
        (name) => {
            expect(elide('Tour de :name', { name })).toBe("Tour d':name");
        },
    );

    it.each(['Marc', '8 octobre', 'Hugo', 'https://chat.example.com', ''])(
        'keeps the full word before "%s"',
        (name) => {
            expect(elide('Tour de :name', { name })).toBe('Tour de :name');
        },
    );

    it('keeps the full word before a number', () => {
        expect(elide('En retard de :count jours', { count: 8 })).toBe(
            'En retard de :count jours',
        );
    });

    it('leaves a word that only ends like an elidable one', () => {
        expect(elide('Le monde :name', { name: 'Inès' })).toBe(
            'Le monde :name',
        );
    });

    it('elides only before its own placeholder, not a longer one that starts the same', () => {
        expect(
            elide('de :first à :firstLabel, de :firstLabel', {
                first: 'Marc',
                firstLabel: 'avril',
            }),
        ).toBe("de :first à :firstLabel, d':firstLabel");
    });
});
