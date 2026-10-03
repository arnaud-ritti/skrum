import { MaxTemplateNameLength } from '@/components/skrum/template-editor';
import type {
    TemplateDraft,
    TemplateTeamOption,
} from '@/components/skrum/template-editor';
import { newDraftColumnId } from '@/lib/retro/template-adapter';
import type { ColumnColor } from '@/lib/retro/types';
import type {
    CatalogueTemplate,
    TemplateCategory,
    TemplateColumn,
    TemplateVisibility,
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
 * The editor hides the description and the default settings, which the
 * server does not store, and the visibility when the source has none.
 */
export function draftFromTemplate(
    template: Pick<WorkspaceTemplateSummary, 'name' | 'category' | 'columns'> &
        Partial<Pick<WorkspaceTemplateSummary, 'visibility' | 'team'>>,
): TemplateDraft {
    return {
        name: template.name,
        category: template.category,
        ...(template.visibility === undefined
            ? {}
            : {
                  visibility: template.visibility,
                  teamId: template.team?.id ?? null,
              }),
        columns: draftColumns(template.columns),
    };
}

/** What the person may share a new template with (spec §6.6). */
export type TemplateSharing = {
    canShareWorkspace: boolean;
    teams: TemplateTeamOption[];
};

/** The widest visibility the person may create: workspace, team, else personal. */
export function defaultVisibility({
    canShareWorkspace,
    teams,
}: TemplateSharing): Pick<TemplateDraft, 'visibility' | 'teamId'> {
    if (canShareWorkspace) {
        return { visibility: 'workspace', teamId: null };
    }

    if (teams.length > 0) {
        return { visibility: 'team', teamId: teams[0].id };
    }

    return { visibility: 'personal', teamId: null };
}

function maySetVisibility(
    visibility: TemplateVisibility,
    teamId: string | null | undefined,
    { canShareWorkspace, teams }: TemplateSharing,
): boolean {
    if (visibility === 'workspace') {
        return canShareWorkspace;
    }

    if (visibility === 'team') {
        return teams.some((team) => team.id === teamId);
    }

    return true;
}

/** A draft to create: it keeps its visibility when the person may set it, else takes theirs. */
export function shareableDraft(
    draft: TemplateDraft,
    sharing: TemplateSharing,
): TemplateDraft {
    if (
        draft.visibility !== undefined &&
        maySetVisibility(draft.visibility, draft.teamId, sharing)
    ) {
        return draft;
    }

    return { ...draft, ...defaultVisibility(sharing) };
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
    visibility?: TemplateVisibility;
    team_id?: string | null;
    columns: { title: string; description: string; color: ColumnColor }[];
} {
    return {
        name: draft.name,
        category: draft.category ?? DefaultTemplateCategory,
        ...(draft.visibility === undefined
            ? {}
            : {
                  visibility: draft.visibility,
                  team_id:
                      draft.visibility === 'team'
                          ? (draft.teamId ?? null)
                          : null,
              }),
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
