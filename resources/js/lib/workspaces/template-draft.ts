import { MaxTemplateNameLength } from '@/components/skrum/template-editor';
import type { TemplateDraft } from '@/components/skrum/template-editor';
import { newDraftColumnId } from '@/lib/retro/template-adapter';
import type { ColumnColor } from '@/lib/retro/types';
import type {
    CatalogueTemplate,
    TemplateCategory,
    TemplateColumn,
    WorkspaceTemplateSummary,
} from '@/types';

export const DefaultTemplateCategory: TemplateCategory = 'essentials';

const FirstColumnColor: ColumnColor = 'moss';

function draftColumns(columns: TemplateColumn[]): TemplateDraft['columns'] {
    return columns.map((column) => ({
        id: newDraftColumnId(),
        title: column.title,
        description: column.description ?? '',
        color: column.color,
    }));
}

/** A new template: one empty column, as the old form opened. */
export function blankTemplateDraft(): TemplateDraft {
    return {
        name: '',
        category: DefaultTemplateCategory,
        columns: [
            {
                id: newDraftColumnId(),
                title: '',
                description: '',
                color: FirstColumnColor,
            },
        ],
    };
}

/**
 * The editor hides the description, the visibility and the default settings
 * when the draft has no such key: the server stores none of them.
 */
export function draftFromTemplate(
    template: Pick<WorkspaceTemplateSummary, 'name' | 'category' | 'columns'>,
): TemplateDraft {
    return {
        name: template.name,
        category: template.category,
        columns: draftColumns(template.columns),
    };
}

/** A built-in template as the start of a new workspace template. */
export function draftFromCatalogue(
    source: CatalogueTemplate,
    name: string,
): TemplateDraft {
    return {
        name,
        category: source.category ?? DefaultTemplateCategory,
        columns: draftColumns(source.columns),
    };
}

/** "Copy of :name", cut to the longest name the server takes. */
export function copyTemplateName(copyName: string): string {
    return Array.from(copyName).slice(0, MaxTemplateNameLength).join('');
}

/** What `workspaces.templates.store` and its `update` take. */
export function templatePayload(draft: TemplateDraft): {
    name: string;
    category: string;
    columns: { title: string; description: string; color: ColumnColor }[];
} {
    return {
        name: draft.name,
        category: draft.category ?? DefaultTemplateCategory,
        columns: draft.columns.map(({ title, description, color }) => ({
            title,
            description: description ?? '',
            color,
        })),
    };
}

function normalize(text: string): string {
    return text.trim().toLocaleLowerCase();
}

/** One search for the three kinds of the templates page. */
export function matchesTemplateQuery(query: string, texts: string[]): boolean {
    const needle = normalize(query);

    return (
        needle === '' ||
        texts.some((text) => text.toLocaleLowerCase().includes(needle))
    );
}
