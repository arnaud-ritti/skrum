import { describe, expect, it } from 'vitest';
import {
    blankTemplateDraft,
    copyTemplateName,
    draftFromCatalogue,
    draftFromTemplate,
    matchesTemplateQuery,
    templatePayload,
} from '@/lib/workspaces/template-draft';
import type { CatalogueTemplate, WorkspaceTemplateSummary } from '@/types';

const template: WorkspaceTemplateSummary = {
    id: 'template-1',
    name: 'Team pulse',
    category: 'team_mood',
    author: null,
    usageCount: 0,
    columns: [
        { title: 'Energy', description: 'How charged you feel', color: 'moss' },
        { title: 'Blockers', description: null, color: 'coral' },
    ],
};

const builtIn: CatalogueTemplate = {
    key: 'start_stop_continue',
    name: 'Start, Stop, Continue',
    category: null,
    isCommon: true,
    isWorkspace: false,
    columns: [{ title: 'Start', description: 'New practices', color: 'moss' }],
};

describe('draftFromTemplate', () => {
    it('keeps the name, the category and the columns, with an id per column and no optional key', () => {
        const draft = draftFromTemplate(template);

        expect(draft.name).toBe('Team pulse');
        expect(draft.category).toBe('team_mood');
        expect(draft.columns.map((column) => column.title)).toEqual([
            'Energy',
            'Blockers',
        ]);
        expect(draft.columns[1].description).toBe('');
        expect(new Set(draft.columns.map((column) => column.id)).size).toBe(2);
        expect('description' in draft).toBe(false);
        expect('visibility' in draft).toBe(false);
        expect('defaults' in draft).toBe(false);
    });
});

describe('draftFromCatalogue', () => {
    it('takes the given name and falls back to the first category', () => {
        const draft = draftFromCatalogue(
            builtIn,
            'Copy of Start, Stop, Continue',
        );

        expect(draft.name).toBe('Copy of Start, Stop, Continue');
        expect(draft.category).toBe('essentials');
        expect(draft.columns[0].description).toBe('New practices');
    });
});

describe('blankTemplateDraft', () => {
    it('opens with one empty moss column in the first category', () => {
        const draft = blankTemplateDraft();

        expect(draft.name).toBe('');
        expect(draft.category).toBe('essentials');
        expect(draft.columns).toHaveLength(1);
        expect(draft.columns[0].title).toBe('');
        expect(draft.columns[0].color).toBe('moss');
    });
});

describe('templatePayload', () => {
    it('sends the columns without their id and an empty description as an empty string', () => {
        expect(
            templatePayload({
                name: 'Team pulse',
                category: 'team_mood',
                columns: [
                    {
                        id: 'a',
                        title: 'Energy',
                        description: null,
                        color: 'moss',
                    },
                    {
                        id: 'b',
                        title: 'Blockers',
                        description: 'Slow',
                        color: 'coral',
                    },
                ],
            }),
        ).toEqual({
            name: 'Team pulse',
            category: 'team_mood',
            columns: [
                { title: 'Energy', description: '', color: 'moss' },
                { title: 'Blockers', description: 'Slow', color: 'coral' },
            ],
        });
    });
});

describe('copyTemplateName', () => {
    it('cuts a copy name to 80 characters', () => {
        expect(copyTemplateName('Copy of 4L')).toBe('Copy of 4L');
        expect(Array.from(copyTemplateName('x'.repeat(120)))).toHaveLength(80);
    });
});

describe('matchesTemplateQuery', () => {
    it('matches any text whatever the case, and everything on an empty query', () => {
        expect(matchesTemplateQuery('  ', ['Sailboat'])).toBe(true);
        expect(matchesTemplateQuery('SAIL', ['4L', 'Sailboat'])).toBe(true);
        expect(matchesTemplateQuery('anchor', ['4L', 'Sailboat'])).toBe(false);
    });
});
