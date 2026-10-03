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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/delete-visit';
import type { DeleteVisitError } from '@/lib/delete-visit';
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

/** The template editor in a side sheet: full width on a phone. */
export function TemplateEditorSheet({ target, onClose, ...props }: Props) {
    const { t } = useTrans();

    return (
        <Sheet
            open={target !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <SheetContent
                aria-describedby={undefined}
                showCloseButton={false}
                className="overflow-y-auto sm:max-w-4xl"
            >
                <SheetTitle className="sr-only">
                    {target?.template ? t('Edit template') : t('New template')}
                </SheetTitle>
                {target !== null && (
                    <EditorBody
                        key={target.key}
                        target={target}
                        onClose={onClose}
                        {...props}
                    />
                )}
            </SheetContent>
        </Sheet>
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
}: Props & { target: TemplateEditorTarget }) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(target.draft);
    const [errors, setErrors] = useState<TemplateEditorErrors>({});
    const [saving, setSaving] = useState(false);
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
        const options = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: onClose,
            onError: (failed: Record<string, string>) => setErrors(failed),
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
                  ).then(onClose, (error: DeleteVisitError) => {
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
            onCancel={onClose}
            onDuplicate={
                template === null ? undefined : () => onDuplicate(draft)
            }
            onDelete={remove}
            className="min-h-full rounded-none border-0 bg-transparent"
        />
    );
}
