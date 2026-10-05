import { router } from '@inertiajs/react';
import { PenTool, Pencil } from 'lucide-react';
import { useState } from 'react';
import WorkspaceWhiteboardTemplatesController from '@/actions/App/Http/Controllers/WorkspaceWhiteboardTemplatesController';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import { TextField } from '@/components/skrum/text-field';
import { WhiteboardTemplatePreview } from '@/components/teams/whiteboard-template-preview';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    TemplateCard,
    TemplateGridClass,
    TemplatesSection,
} from '@/components/workspaces/template-card';
import {
    templateCardMenu,
    useMenuDialogFocus,
} from '@/components/workspaces/use-menu-dialog-focus';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/visit';
import type { VisitError } from '@/lib/visit';
import { workspaceTemplateKey } from '@/lib/workspaces/use-template';
import type { TemplateKind } from '@/lib/workspaces/use-template';
import type { WorkspaceSummary, WorkspaceWhiteboardTemplate } from '@/types';

const WhiteboardTemplateNameMaxLength = 80;
const WhiteboardTemplateDescriptionMaxLength = 300;

/** The whiteboard templates of the workspace: saved from a board's menu. */
export function WhiteboardTemplatesTab({
    workspace,
    templates,
    total = templates.length,
    hrefFor,
}: {
    workspace: WorkspaceSummary;
    /** The templates to show: the ones the search kept. */
    templates: WorkspaceWhiteboardTemplate[];
    /** How many the workspace has: the empty state shows at zero only. */
    total?: number;
    hrefFor: (kind: TemplateKind, key: string) => string | null;
}) {
    const { t } = useTrans();
    const rename = useRouterAction();
    const [renaming, setRenaming] =
        useState<WorkspaceWhiteboardTemplate | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [deleting, setDeleting] =
        useState<WorkspaceWhiteboardTemplate | null>(null);
    const [deleteError, setDeleteError] = useState<string>();
    const { fallbackRef, openedFrom, originRemoved } =
        useMenuDialogFocus<HTMLHeadingElement>(isRenaming || deleting !== null);

    const openedFromMenuOf = (template: WorkspaceWhiteboardTemplate): void =>
        openedFrom(
            templateCardMenu(`workspace-whiteboard-template-${template.id}`),
        );

    const urlOf = (template: WorkspaceWhiteboardTemplate) => ({
        workspace: workspace.slug,
        whiteboardTemplate: template.id,
    });

    const remove = (template: WorkspaceWhiteboardTemplate): Promise<void> => {
        setDeleteError(undefined);

        return deleteVisit(
            WorkspaceWhiteboardTemplatesController.destroy.url(urlOf(template)),
        ).then(originRemoved, (error: VisitError) => {
            setDeleteError(
                Object.values(error.errors)[0] ??
                    t('Something went wrong. Please try again.'),
            );

            throw error;
        });
    };

    const menuOf = (template: WorkspaceWhiteboardTemplate): MenuEntry[] =>
        template.canManage
            ? [
                  {
                      type: 'item',
                      label: t('Rename'),
                      icon: Pencil,
                      onSelect: () => {
                          openedFromMenuOf(template);
                          rename.reset();
                          setRenaming(template);
                          setIsRenaming(true);
                      },
                  },
                  { type: 'separator' },
                  {
                      type: 'item',
                      label: t('Delete'),
                      tone: 'danger',
                      onSelect: () => {
                          openedFromMenuOf(template);
                          setDeleting(template);
                      },
                  },
              ]
            : [];

    return (
        <TemplatesSection
            icon={PenTool}
            title={t('Whiteboard')}
            headingRef={fallbackRef}
        >
            {total === 0 ? (
                <div
                    data-slot="whiteboard-templates-empty"
                    className="rounded-xl border border-dashed border-input bg-card/50"
                >
                    <EmptyState
                        module="whiteboard"
                        headingLevel="h3"
                        title={t('No whiteboard templates yet.')}
                        description={t(
                            'Save any whiteboard as a template from its menu — every team of :workspace will be able to start from it.',
                            { workspace: workspace.name },
                        )}
                    />
                </div>
            ) : (
                <ul
                    aria-label={t('Whiteboard')}
                    data-slot="whiteboard-template-cards"
                    className={TemplateGridClass}
                >
                    {templates.map((template) => (
                        <li key={template.id} className="min-w-0">
                            <TemplateCard
                                data-test={`workspace-whiteboard-template-${template.id}`}
                                name={template.name}
                                meta={template.description ?? undefined}
                                preview={
                                    <WhiteboardTemplatePreview
                                        preview={template.preview}
                                        className="flex-1"
                                    />
                                }
                                useHref={hrefFor(
                                    'whiteboard',
                                    workspaceTemplateKey(template.id),
                                )}
                                menu={menuOf(template)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <FormDialog
                open={isRenaming}
                onOpenChange={(next) => {
                    if (!next) {
                        setIsRenaming(false);
                    }
                }}
                title={t('Rename the template')}
                submitLabel={t('Save')}
                onSubmit={(data) => {
                    if (renaming === null) {
                        return Promise.resolve();
                    }

                    const name = data.get('name');
                    const description = data.get('description');

                    return rename.run((options) =>
                        router.patch(
                            WorkspaceWhiteboardTemplatesController.update.url(
                                urlOf(renaming),
                            ),
                            {
                                name: typeof name === 'string' ? name : '',
                                description:
                                    typeof description === 'string'
                                        ? description
                                        : '',
                            },
                            options,
                        ),
                    );
                }}
                error={rename.error}
            >
                <TextField
                    label={t('Name')}
                    name="name"
                    required
                    autoFocus
                    defaultValue={renaming?.name ?? ''}
                    maxLength={WhiteboardTemplateNameMaxLength}
                />
                <TextField
                    label={t('Description')}
                    name="description"
                    defaultValue={renaming?.description ?? ''}
                    maxLength={WhiteboardTemplateDescriptionMaxLength}
                />
            </FormDialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleting(null);
                        setDeleteError(undefined);
                    }
                }}
                title={t('Delete this template?')}
                description={t(
                    'Boards already created from it are not changed.',
                )}
                confirmLabel={t('Delete')}
                tone="destructive"
                error={deleteError}
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : remove(deleting)
                }
            />
        </TemplatesSection>
    );
}
