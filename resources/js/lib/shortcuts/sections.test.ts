import { describe, expect, it } from 'vitest';
import { contextOfPage, shortcutSections } from '@/lib/shortcuts/sections';

const t = (key: string) => key;

function ids(sections: ReturnType<typeof shortcutSections>): string[] {
    return sections.flatMap((section) =>
        section.items.map((item) => `${section.id}.${item.id}`),
    );
}

describe('shortcutSections', () => {
    it('always starts with the general section and its four shortcuts', () => {
        const [general] = shortcutSections(t);

        expect(general.id).toBe('general');
        expect(general.items.map((item) => item.id)).toEqual([
            'palette',
            'search',
            'shortcuts',
            'sidebar',
        ]);
    });

    it('leaves out the shortcuts of a control that is not on screen', () => {
        const [general] = shortcutSections(t, {
            palette: false,
            sidebar: false,
        });

        expect(general.items.map((item) => item.id)).toEqual(['shortcuts']);
    });

    it('lists no shortcut twice inside a section', () => {
        for (const section of shortcutSections(t)) {
            const signatures = section.items.map((item) =>
                [...item.keys, ...(item.range ?? [])].join('+'),
            );

            expect(new Set(signatures).size).toBe(signatures.length);
        }
    });

    it('lists the five shortcuts of spec B35 in their sections', () => {
        expect(ids(shortcutSections(t))).toEqual(
            expect.arrayContaining([
                'retro.group',
                'retro.focus',
                'retro.next-phase',
                'poker.coffee',
                'poker.revote',
            ]),
        );
    });

    it('lists the keys of the "?" and coffee cards only for a deck that holds them', () => {
        expect(ids(shortcutSections(t))).toEqual(
            expect.arrayContaining(['poker.unknown', 'poker.coffee']),
        );

        const withoutSpecials = ids(
            shortcutSections(t, { deck: ['1', '2', '3'] }),
        );

        expect(withoutSpecials).not.toContain('poker.unknown');
        expect(withoutSpecials).not.toContain('poker.coffee');

        const withUnknown = ids(shortcutSections(t, { deck: ['1', '?'] }));

        expect(withUnknown).toContain('poker.unknown');
        expect(withUnknown).not.toContain('poker.coffee');
    });

    it('lists the keys the whiteboard canvas answers to', () => {
        const whiteboard = shortcutSections(t).find(
            (section) => section.id === 'whiteboard',
        );

        expect(whiteboard?.items.map((item) => item.id)).toEqual([
            'select',
            'hand',
            'rectangle',
            'text',
            'pencil',
            'arrow',
            'pan',
            'undo',
            'redo',
            'zoom-in',
            'zoom-out',
        ]);
    });

    it('finds the reaction keys under the name of their section', () => {
        const reactions = shortcutSections(t).find(
            (section) => section.id === 'reactions',
        );

        expect(
            reactions?.items.every((item) =>
                item.keywords?.includes('Reactions'),
            ),
        ).toBe(true);
    });

    it('marks the facilitator shortcuts', () => {
        const items = shortcutSections(t).flatMap((section) => section.items);
        const facilitatorOnly = (id: string) =>
            items.find((item) => item.id === id)?.facilitatorOnly === true;

        expect(['focus', 'next-phase', 'revote'].every(facilitatorOnly)).toBe(
            true,
        );
        expect(facilitatorOnly('group')).toBe(false);
        expect(facilitatorOnly('coffee')).toBe(false);
    });

    it('shows the six quick reactions under their digits', () => {
        const reactions = shortcutSections(t).find(
            (section) => section.id === 'reactions',
        );

        expect(reactions?.items.map((item) => item.keys)).toEqual([
            ['1'],
            ['2'],
            ['3'],
            ['4'],
            ['5'],
            ['6'],
        ]);
    });
});

describe('contextOfPage', () => {
    it('maps a session page to its section', () => {
        expect(contextOfPage('retros/show')).toBe('retro');
        expect(contextOfPage('poker/show')).toBe('poker');
        expect(contextOfPage('whiteboards/show')).toBe('whiteboard');
    });

    it('has no context elsewhere', () => {
        expect(contextOfPage('teams/show')).toBeUndefined();
        expect(contextOfPage('settings/profile')).toBeUndefined();
    });
});
