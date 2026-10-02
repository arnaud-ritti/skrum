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

    it('does not list the shortcuts that have no handler', () => {
        const listed = ids(shortcutSections(t));

        expect(listed).not.toContain('retro.group');
        expect(listed).not.toContain('retro.focus');
        expect(listed).not.toContain('retro.next');
        expect(listed).not.toContain('poker.coffee');
        expect(listed).not.toContain('poker.revote');
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
