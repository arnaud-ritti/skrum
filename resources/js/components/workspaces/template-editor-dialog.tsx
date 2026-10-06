import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import { TemplateEditor } from '@/components/skrum/template-editor';
import type {
    TemplateDraft,
    TemplateEditorErrors,
    TemplateTeamOption,
} from '@/components/skrum/template-editor';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/visit';
import type { VisitError } from '@/lib/visit';
import {
    DefaultTemplateCategory,
    templatePayload,
} from '@/lib/workspaces/template-draft';
import type {
    CatalogueTemplate,
    CategoryOption,
    WorkspaceSummary,
    WorkspaceTemplateSummary,
} from '@/types';

/** What the editor opens on. `key` changes with each opening. */
export type TemplateEditorTarget = {
    key: string;
    /** `null`: a new template. */
    template: WorkspaceTemplateSummary | null;
    draft: TemplateDraft;
};

type Props = {
    workspace: WorkspaceSummary;
    target: TemplateEditorTarget | null;
    categories: CategoryOption[];
    /** Its built-in templates are the choices of "Start from a built-in template". */
    catalogue?: CatalogueTemplate[];
    onClose: () => void;
    /** A copy of the draft being edited, to open as a new template. */
    onDuplicate: (draft: TemplateDraft) => void;
    /** A new template is a team template of this team. */
    teamId?: string;
    /** "Workspace" is disabled without it. */
    canShareWorkspace?: boolean;
    /** The teams the person may create team templates for. */
    teams?: TemplateTeamOption[];
};

/**
 * The template editor in a dialog, built like the deck dialog: the form beside
 * its preview, which scroll between the header and the footer.
 */
export function TemplateEditorDialog({ target, onClose, ...props }: Props) {
    const { t } = useTrans();
    const [saving, setSaving] = useState(false);

    /** A save on its way keeps the dialog open: its answer has a place to land. */
    const close = (): void => {
        if (!saving) {
            onClose();
        }
    };

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => {
                if (!open) {
                    close();
                }
            }}
        >
            <DialogContent
                aria-describedby={undefined}
                closeLabel={t('Close')}
                className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
            >
                <DialogTitle className="sr-only">
                    {target?.template ? t('Edit template') : t('New template')}
                </DialogTitle>
                {target !== null && (
                    <EditorBody
                        key={target.key}
                        target={target}
                        onClose={onClose}
                        onCancel={close}
                        saving={saving}
                        onSavingChange={setSaving}
                        {...props}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function EditorBody({
    workspace,
    target,
    categories,
    catalogue,
    onClose,
    onDuplicate,
    teamId,
    canShareWorkspace,
    teams,
    onCancel,
    saving,
    onSavingChange,
}: Props & {
    target: TemplateEditorTarget;
    onCancel: () => void;
    saving: boolean;
    onSavingChange: (saving: boolean) => void;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(target.draft);
    const [errors, setErrors] = useState<TemplateEditorErrors>({});
    const { template } = target;
    const builtIns = (catalogue ?? []).filter(
        (item) => !item.isWorkspace && item.columns.length > 0,
    );

    const startFrom = (key: string): void => {
        const source = builtIns.find((item) => item.key === key);

        if (source === undefined) {
            return;
        }

        setDraft((current) => ({
            ...current,
            name: current.name.trim() === '' ? source.name : current.name,
            category: source.category ?? DefaultTemplateCategory,
            columns: source.columns.map((column, index) => ({
                id: `${target.key}-${key}-${index}`,
                title: column.title,
                description: column.description ?? '',
                color: column.color,
            })),
        }));
    };

    const save = (): void => {
        let settled = false;
        const options = {
            preserveScroll: true,
            onStart: () => onSavingChange(true),
            onFinish: () => {
                onSavingChange(false);

                if (!settled) {
                    toast.error(t('Something went wrong. Please try again.'));
                }
            },
            onSuccess: () => {
                settled = true;
                onClose();
            },
            onError: (failed: Record<string, string>) => {
                settled = true;
                setErrors(failed);
            },
        };

        if (template === null) {
            router.post(
                WorkspaceTemplatesController.store.url(workspace.slug),
                teamId === undefined
                    ? templatePayload(draft)
                    : {
                          ...templatePayload(draft),
                          visibility: 'team',
                          team_id: teamId,
                      },
                options,
            );

            return;
        }

        router.patch(
            WorkspaceTemplatesController.update.url({
                workspace: workspace.slug,
                template: template.id,
            }),
            templatePayload(draft),
            options,
        );
    };

    const remove =
        template === null
            ? undefined
            : (): Promise<void> =>
                  deleteVisit(
                      WorkspaceTemplatesController.destroy.url({
                          workspace: workspace.slug,
                          template: template.id,
                      }),
                  ).then(onClose, (error: VisitError) => {
                      toast.error(
                          Object.values(error.errors)[0] ??
                              t('Something went wrong. Please try again.'),
                      );

                      throw error;
                  });

    return (
        <TemplateEditor
            mode={template === null ? 'create' : 'edit'}
            value={draft}
            onChange={(next) => {
                setDraft(next);
                setErrors({});
            }}
            errors={errors}
            categories={categories}
            canShareWorkspace={canShareWorkspace}
            teams={teams}
            startFrom={builtIns.map((item) => ({
                key: item.key,
                name: item.name,
            }))}
            onStartFrom={startFrom}
            saving={saving}
            onSave={save}
            onCancel={onCancel}
            onDuplicate={
                template === null ? undefined : () => onDuplicate(draft)
            }
            onDelete={remove}
            className="min-h-0 flex-1 rounded-none border-0 bg-transparent [&>header]:pr-14"
        />
    );
}
