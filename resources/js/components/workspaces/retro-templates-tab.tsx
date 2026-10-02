import { router } from '@inertiajs/react';
import { Copy, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RetroTemplatePicker } from '@/components/skrum/retro-template-picker';
import type { RetroTemplate } from '@/components/skrum/retro-template-picker';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    TemplateCard,
    TemplateColumnsPreview,
    TemplateGridClass,
} from '@/components/workspaces/template-card';
import { useTrans } from '@/hooks/use-trans';
import { toRetroTemplate } from '@/lib/retro/template-adapter';
import { workspaceTemplateKey } from '@/lib/workspaces/use-template';
import type { TemplateKind } from '@/lib/workspaces/use-template';
import type {
    CatalogueTemplate,
    CategoryOption,
    WorkspaceTemplateSummary,
} from '@/types';

type HrefFor = (kind: TemplateKind, key: string) => string | null;

/** What a manager may do with a workspace template; absent for a member. */
export type RetroTemplateActions = {
    onEdit: (template: WorkspaceTemplateSummary) => void;
    onDuplicate: (template: WorkspaceTemplateSummary) => void;
    onDelete: (template: WorkspaceTemplateSummary) => void;
};

/** The workspace's retro templates as cards: the "All" view of the page. */
export function RetroTemplateCards({
    templates,
    hrefFor,
    actions,
    visibilityFor,
}: {
    templates: WorkspaceTemplateSummary[];
    hrefFor: HrefFor;
    actions?: RetroTemplateActions;
    /** WS-2: the visibility badge of a template. */
    visibilityFor?: (template: WorkspaceTemplateSummary) => ReactNode;
}) {
    const { t } = useTrans();

    const menuOf = (template: WorkspaceTemplateSummary): MenuEntry[] =>
        actions === undefined
            ? []
            : [
                  {
                      type: 'item',
                      label: t('Edit'),
                      icon: Pencil,
                      onSelect: () => actions.onEdit(template),
                  },
                  {
                      type: 'item',
                      label: t('Duplicate'),
                      icon: Copy,
                      onSelect: () => actions.onDuplicate(template),
                  },
                  { type: 'separator' },
                  {
                      type: 'item',
                      label: t('Delete'),
                      tone: 'danger',
                      onSelect: () => actions.onDelete(template),
                  },
              ];

    return (
        <ul
            aria-label={t('Retrospective')}
            data-slot="retro-template-cards"
            className={TemplateGridClass}
        >
            {templates.map((template) => (
                <li key={template.id} className="min-w-0">
                    <TemplateCard
                        data-test={`workspace-template-${template.id}`}
                        name={template.name}
                        meta={[
                            template.columns.length === 1
                                ? t('1 column')
                                : t(':count columns', {
                                      count: template.columns.length,
                                  }),
                            t('used :count×', { count: template.usageCount }),
                        ].join(' · ')}
                        preview={
                            <TemplateColumnsPreview
                                columns={template.columns}
                            />
                        }
                        author={template.author}
                        useHref={hrefFor(
                            'retro',
                            workspaceTemplateKey(template.id),
                        )}
                        menu={menuOf(template)}
                        badge={visibilityFor?.(template)}
                    />
                </li>
            ))}
        </ul>
    );
}

function workspaceRetroTemplate(
    template: WorkspaceTemplateSummary,
): RetroTemplate {
    return {
        id: workspaceTemplateKey(template.id),
        name: template.name,
        category: template.category,
        source: 'workspace',
        columns: template.columns,
        usageCount: template.usageCount,
        ...(template.author === null ? {} : { author: template.author.name }),
    };
}

/**
 * The built-in templates of the catalogue, then the workspace's own: those
 * come from the page's `templates`, which every visit refreshes, and not
 * from the catalogue, which is loaded on demand.
 */
export function pickerTemplates(
    catalogue: CatalogueTemplate[],
    templates: WorkspaceTemplateSummary[],
): RetroTemplate[] {
    return [
        ...catalogue.filter((item) => !item.isWorkspace && item.isCommon),
        ...catalogue.filter((item) => !item.isWorkspace && !item.isCommon),
    ]
        .map(toRetroTemplate)
        .concat(templates.map(workspaceRetroTemplate));
}

/** The "Retro" tab: the full picker, built-in templates included (9-D2). */
export function RetroTemplatesTab({
    templates,
    catalogue,
    categories,
    query,
    onQueryChange,
    hrefFor,
    hasTeam,
    onCreate,
    onEdit,
    onDuplicate,
}: {
    templates: WorkspaceTemplateSummary[];
    /** `undefined` while the catalogue loads. */
    catalogue?: CatalogueTemplate[];
    categories: CategoryOption[];
    query: string;
    onQueryChange: (query: string) => void;
    hrefFor: HrefFor;
    hasTeam: boolean;
    /** The three below are given to a manager only. */
    onCreate?: () => void;
    onEdit?: (template: WorkspaceTemplateSummary) => void;
    onDuplicate?: (source: RetroTemplate) => void;
}) {
    const { t } = useTrans();
    const [picked, setPicked] = useState<string | null>(null);
    const items = useMemo(
        () => pickerTemplates(catalogue ?? [], templates),
        [catalogue, templates],
    );
    const value =
        picked !== null && items.some((item) => item.id === picked)
            ? picked
            : (items[0]?.id ?? '');

    const use = (id: string): void => {
        const href = hrefFor('retro', id);

        if (href !== null) {
            router.visit(href);
        }
    };

    const edit =
        onEdit === undefined
            ? undefined
            : (id: string): void => {
                  const template = templates.find(
                      (item) => workspaceTemplateKey(item.id) === id,
                  );

                  if (template !== undefined) {
                      onEdit(template);
                  }
              };

    const duplicate =
        onDuplicate === undefined
            ? undefined
            : (id: string): void => {
                  const source = items.find((item) => item.id === id);

                  if (source !== undefined) {
                      onDuplicate(source);
                  }
              };

    return (
        <RetroTemplatePicker
            value={value}
            onValueChange={setPicked}
            templates={items}
            categories={categories}
            query={query}
            onQueryChange={onQueryChange}
            loading={catalogue === undefined}
            onUse={use}
            useDisabledReason={hasTeam ? undefined : t('Pick a team first')}
            onDuplicate={duplicate}
            onEdit={edit}
            onCreate={onCreate}
        />
    );
}
