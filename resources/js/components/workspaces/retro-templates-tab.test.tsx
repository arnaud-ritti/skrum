import { describe, expect, it } from 'vitest';
import { pickerTemplates } from '@/components/workspaces/retro-templates-tab';
import type { CatalogueTemplate, WorkspaceTemplateSummary } from '@/types';

function builtIn(key: string, isCommon: boolean): CatalogueTemplate {
    return {
        key,
        name: key,
        category: 'essentials',
        isCommon,
        isWorkspace: false,
        columns: [{ title: 'One', description: null, color: 'moss' }],
    };
}

const stale: CatalogueTemplate = {
    ...builtIn('workspace:gone', false),
    isWorkspace: true,
};

const template: WorkspaceTemplateSummary = {
    id: 'template-1',
    name: 'Team pulse',
    category: 'team_mood',
    author: { name: 'Ada Lovelace', avatarUrl: '' },
    usageCount: 3,
    columns: [{ title: 'Energy', description: null, color: 'moss' }],
};

describe('pickerTemplates', () => {
    it('lists the common built-in templates, the others, then the templates of the page', () => {
        const items = pickerTemplates(
            [stale, builtIn('sailboat', false), builtIn('four_ls', true)],
            [template],
        );

        expect(items.map((item) => item.id)).toEqual([
            'four_ls',
            'sailboat',
            'workspace:template-1',
        ]);
        expect(items[2]).toMatchObject({
            source: 'workspace',
            name: 'Team pulse',
            category: 'team_mood',
            author: 'Ada Lovelace',
            usageCount: 3,
        });
    });

    it('leaves the author out when the account is gone', () => {
        const [item] = pickerTemplates([], [{ ...template, author: null }]);

        expect('author' in item).toBe(false);
    });
});
