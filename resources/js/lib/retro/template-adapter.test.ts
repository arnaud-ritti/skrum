import { describe, expect, it } from 'vitest';
import {
    defaultTemplateKey,
    draftColumns,
    sameColumns,
    shortcutTemplates,
    toRetroTemplate,
    toRetroTemplates,
} from '@/lib/retro/template-adapter';
import type { CatalogueTemplate } from '@/types';

function template(
    key: string,
    overrides: Partial<CatalogueTemplate> = {},
): CatalogueTemplate {
    return {
        key,
        name: key,
        category: 'essentials',
        isCommon: false,
        isWorkspace: false,
        columns: [
            {
                title: 'Start',
                description: 'What should begin?',
                color: 'green',
            },
            { title: 'Stop', description: null, color: 'red' },
        ],
        ...overrides,
    };
}

const catalogue: CatalogueTemplate[] = [
    template('workspace:w1', { name: 'Team pulse', isWorkspace: true }),
    template('custom', { name: 'Custom', category: null, columns: [] }),
    template('four_ls'),
    template('sailboat', { isCommon: true }),
    template('start_stop_continue', { isCommon: true }),
];

describe('toRetroTemplate', () => {
    it('maps the key, the source and the columns', () => {
        expect(toRetroTemplate(catalogue[0])).toEqual({
            id: 'workspace:w1',
            name: 'Team pulse',
            category: 'essentials',
            source: 'workspace',
            columns: [
                {
                    title: 'Start',
                    color: 'green',
                    description: 'What should begin?',
                },
                { title: 'Stop', color: 'red', description: null },
            ],
        });
        expect(toRetroTemplate(catalogue[2]).source).toBe('builtin');
    });

    it('lists the common templates first and keeps the order otherwise', () => {
        expect(toRetroTemplates(catalogue).map((item) => item.id)).toEqual([
            'sailboat',
            'start_stop_continue',
            'workspace:w1',
            'custom',
            'four_ls',
        ]);
    });
});

describe('shortcutTemplates', () => {
    it('follows the order of topTemplates', () => {
        expect(
            shortcutTemplates(catalogue, [
                'sailboat',
                'workspace:w1',
                'four_ls',
            ]).map((item) => item.id),
        ).toEqual(['sailboat', 'workspace:w1', 'four_ls']);
    });

    it('skips a key that is absent from the catalogue', () => {
        expect(
            shortcutTemplates(catalogue, [
                'gone',
                'four_ls',
                'workspace:deleted',
                'sailboat',
            ]).map((item) => item.id),
        ).toEqual(['four_ls', 'sailboat']);
    });

    it('never returns more than five', () => {
        const many = Array.from({ length: 8 }, (_, index) =>
            template(`t${index}`),
        );

        expect(
            shortcutTemplates(
                many,
                many.map((item) => item.key),
            ),
        ).toHaveLength(5);
    });
});

describe('defaultTemplateKey', () => {
    it('takes the template of the intent when the catalogue has it', () => {
        expect(defaultTemplateKey(catalogue, ['sailboat'], 'four_ls')).toBe(
            'four_ls',
        );
    });

    it('falls back to the first shortcut, then to the first built-in', () => {
        expect(defaultTemplateKey(catalogue, ['sailboat'], 'gone')).toBe(
            'sailboat',
        );
        expect(defaultTemplateKey(catalogue, ['gone'])).toBe('custom');
        expect(defaultTemplateKey([], [])).toBe('');
    });
});

describe('draft columns', () => {
    it('gives each column an id and keeps title, description and colour', () => {
        const draft = draftColumns(toRetroTemplate(catalogue[2]));

        expect(
            draft.map(({ title, description, color }) => [
                title,
                description,
                color,
            ]),
        ).toEqual([
            ['Start', 'What should begin?', 'green'],
            ['Stop', null, 'red'],
        ]);
        expect(new Set(draft.map((column) => column.id)).size).toBe(2);
    });

    it('tells a changed draft from an untouched one', () => {
        const source = toRetroTemplate(catalogue[2]);
        const draft = draftColumns(source);

        expect(sameColumns(draft, source.columns)).toBe(true);
        expect(
            sameColumns(
                [{ ...draft[0], title: 'Begin' }, draft[1]],
                source.columns,
            ),
        ).toBe(false);
        expect(sameColumns([draft[1], draft[0]], source.columns)).toBe(false);
        expect(
            sameColumns(
                [{ ...draft[0], color: 'blue' }, draft[1]],
                source.columns,
            ),
        ).toBe(false);
        expect(sameColumns([draft[0]], source.columns)).toBe(false);
    });
});
