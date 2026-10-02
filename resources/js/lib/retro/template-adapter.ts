import type {
    RetroTemplate,
    RetroTemplateColumn,
} from '@/components/skrum/retro-template-picker';
import type { ColumnColor } from '@/lib/retro/types';
import type { CatalogueTemplate } from '@/types';

export const MaxShortcuts = 5;

/** A column of the board about to be created, as the creation dialog edits it. */
export type DraftColumn = {
    id: string;
    title: string;
    description: string | null;
    color: ColumnColor;
};

export function toRetroTemplate(item: CatalogueTemplate): RetroTemplate {
    return {
        id: item.key,
        name: item.name,
        category: item.category,
        source: item.isWorkspace ? 'workspace' : 'builtin',
        columns: item.columns.map((column) => ({
            title: column.title,
            color: column.color,
            description: column.description,
        })),
    };
}

/** The picker has no "common" section any more: common templates come first. */
export function toRetroTemplates(
    catalogue: CatalogueTemplate[],
): RetroTemplate[] {
    return [
        ...catalogue.filter((item) => item.isCommon),
        ...catalogue.filter((item) => !item.isCommon),
    ].map(toRetroTemplate);
}

export function shortcutTemplates(
    catalogue: CatalogueTemplate[],
    topTemplates: string[],
): RetroTemplate[] {
    return topTemplates
        .map((key) => catalogue.find((item) => item.key === key))
        .filter((item): item is CatalogueTemplate => item !== undefined)
        .slice(0, MaxShortcuts)
        .map(toRetroTemplate);
}

export function defaultTemplateKey(
    catalogue: CatalogueTemplate[],
    topTemplates: string[],
    intentTemplate?: string,
): string {
    const has = (key: string | undefined): key is string =>
        key !== undefined && catalogue.some((item) => item.key === key);

    if (has(intentTemplate)) {
        return intentTemplate;
    }

    return (
        topTemplates.find(has) ??
        catalogue.find((item) => !item.isWorkspace)?.key ??
        ''
    );
}

let draftCounter = 0;

export function newDraftColumnId(): string {
    draftCounter += 1;

    return `draft-column-${draftCounter}`;
}

export function draftColumns(
    template: RetroTemplate | undefined,
): DraftColumn[] {
    return (template?.columns ?? []).map((column) => ({
        id: newDraftColumnId(),
        title: column.title,
        description: column.description ?? null,
        color: column.color,
    }));
}

export function sameColumns(
    draft: DraftColumn[],
    columns: RetroTemplateColumn[],
): boolean {
    return (
        draft.length === columns.length &&
        draft.every(
            (column, index) =>
                column.title === columns[index].title &&
                column.color === columns[index].color &&
                (column.description ?? null) ===
                    (columns[index].description ?? null),
        )
    );
}
