import { router } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import WorkspaceWhiteboardTemplatesController from '@/actions/App/Http/Controllers/WorkspaceWhiteboardTemplatesController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardTemplateSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    templates: WhiteboardTemplateSummary[];
};

function reloadTemplates(): void {
    router.reload({ only: ['whiteboardTemplates', 'whiteboardGallery'] });
}

/** A template gone or no longer the viewer's: say so, then show the list as it is now. */
function refused(message: string): false {
    toast.error(message);
    reloadTemplates();

    return false;
}

type DialogProps = Props & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where focus goes back: the dialog has no trigger of its own. */
    onCloseAutoFocus?: (event: Event) => void;
};

/** Opened under the Whiteboard chip of the Sessions page. */
export function WhiteboardTemplatesDialog({
    open,
    onOpenChange,
    onCloseAutoFocus,
    ...props
}: DialogProps) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader>
                    <DialogTitle>{t('Whiteboard templates')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'Everyone in the workspace can start a board from them.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                {open && <WhiteboardTemplatesManager {...props} />}
            </DialogContent>
        </Dialog>
    );
}

/** The rows of the manager, without their dialog. */
export function WhiteboardTemplatesManager({
    workspaceSlug,
    templates,
    initialEditingId = null,
}: Props & {
    /** The template whose row opens as its edit form. */
    initialEditingId?: string | null;
}) {
    const { t } = useTrans();
    const [editingId, setEditingId] = useState<string | null>(initialEditingId);
    const [deleting, setDeleting] = useState<WhiteboardTemplateSummary | null>(
        null,
    );
    const rootRef = useRef<HTMLDivElement>(null);
    const deletedId = useRef<string | null>(null);
    const editedId = useRef<string | null>(initialEditingId);
    const refusal = t("This template no longer exists or you can't change it.");

    // The row or the form that held the focus leaves: the focus goes back to
    // the Edit button of the row, or to the list once a row is gone.
    useEffect(() => {
        if (editingId !== null || editedId.current === null) {
            return;
        }

        const editButton = rootRef.current?.querySelector<HTMLElement>(
            `[data-template-edit="${editedId.current}"]`,
        );

        editedId.current = null;
        (editButton ?? rootRef.current)?.focus();
    }, [editingId]);

    useEffect(() => {
        if (deletedId.current === null) {
            return;
        }

        if (templates.some((template) => template.id === deletedId.current)) {
            return;
        }

        deletedId.current = null;
        rootRef.current?.focus();
    }, [templates]);

    const edit = (id: string | null): void => {
        editedId.current = editingId ?? id;
        setEditingId(id);
    };

    const remove = (template: WhiteboardTemplateSummary): Promise<void> =>
        new Promise((resolve) => {
            const done = (): void => {
                deletedId.current = template.id;
                setDeleting(null);
                resolve();
            };

            router.delete(
                WorkspaceWhiteboardTemplatesController.destroy({
                    workspace: workspaceSlug,
                    whiteboardTemplate: template.id,
                }).url,
                {
                    preserveScroll: true,
                    onHttpException: () => refused(refusal),
                    onFinish: done,
                },
            );
        });

    return (
        <div
            ref={rootRef}
            tabIndex={-1}
            aria-label={t('Whiteboard templates')}
            className="flex min-w-0 flex-col outline-none"
        >
            {templates.length === 0 && (
                <EmptyState
                    module="whiteboard"
                    headingLevel="h3"
                    title={t('No whiteboard templates yet.')}
                    description={t('Save a board as a template from its menu.')}
                    className="py-4"
                />
            )}
            {templates.length > 0 && (
                <ul className="divide-y rounded-lg border">
                    {templates.map((template) => (
                        <li key={template.id} className="min-w-0 p-3">
                            {editingId === template.id ? (
                                <TemplateEditForm
                                    workspaceSlug={workspaceSlug}
                                    template={template}
                                    onDone={() => edit(null)}
                                />
                            ) : (
                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                    <div className="min-w-32 flex-1">
                                        <p className="text-sm font-medium wrap-anywhere">
                                            {template.name}
                                        </p>
                                        {template.description !== null &&
                                            template.description !== '' && (
                                                <p
                                                    data-slot="template-description"
                                                    className="mt-0.5 text-body-sm wrap-anywhere text-muted-foreground"
                                                >
                                                    {template.description}
                                                </p>
                                            )}
                                    </div>
                                    {template.canManage && (
                                        <div className="flex min-w-0 shrink-0 flex-wrap gap-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="max-w-full min-w-0"
                                                aria-label={t('Edit :name', {
                                                    name: template.name,
                                                })}
                                                data-template-edit={template.id}
                                                onClick={() =>
                                                    edit(template.id)
                                                }
                                            >
                                                <Pencil aria-hidden />
                                                {t('Edit')}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="max-w-full min-w-0 text-skrum-destructive-text hover:text-skrum-destructive-text"
                                                aria-label={t('Delete :name', {
                                                    name: template.name,
                                                })}
                                                onClick={() =>
                                                    setDeleting(template)
                                                }
                                            >
                                                <Trash2 aria-hidden />
                                                {t('Delete')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleting(null);
                    }
                }}
                title={t('Delete this template?')}
                description={t(
                    'Boards already created from it are not changed.',
                )}
                confirmLabel={t('Delete')}
                tone="destructive"
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : remove(deleting)
                }
            />
        </div>
    );
}

function TemplateEditForm({
    workspaceSlug,
    template,
    onDone,
}: {
    workspaceSlug: string;
    template: WhiteboardTemplateSummary;
    onDone: () => void;
}) {
    const { t } = useTrans();
    const [name, setName] = useState(template.name);
    const [description, setDescription] = useState(template.description ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const idPrefix = `whiteboard-template-${template.id}`;

    const submit = (event: FormEvent): void => {
        event.preventDefault();

        router.patch(
            WorkspaceWhiteboardTemplatesController.update({
                workspace: workspaceSlug,
                whiteboardTemplate: template.id,
            }).url,
            { name, description },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: onDone,
                onError: (failed) => setErrors(failed),
                onHttpException: () => {
                    onDone();

                    return refused(
                        t(
                            "This template no longer exists or you can't change it.",
                        ),
                    );
                },
            },
        );
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>{t('Name')}</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={name}
                    maxLength={80}
                    required
                    autoFocus
                    aria-invalid={errors.name !== undefined || undefined}
                    aria-describedby={
                        errors.name === undefined
                            ? undefined
                            : `${idPrefix}-name-error`
                    }
                    onChange={(event) => setName(event.target.value)}
                />
                {errors.name !== undefined && (
                    <p
                        id={`${idPrefix}-name-error`}
                        role="alert"
                        className="text-xs text-skrum-destructive-text"
                    >
                        {errors.name}
                    </p>
                )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-description`}>
                    {t('Description')}
                </Label>
                <Input
                    id={`${idPrefix}-description`}
                    value={description}
                    maxLength={300}
                    aria-invalid={errors.description !== undefined || undefined}
                    aria-describedby={
                        errors.description === undefined
                            ? undefined
                            : `${idPrefix}-description-error`
                    }
                    onChange={(event) => setDescription(event.target.value)}
                />
                {errors.description !== undefined && (
                    <p
                        id={`${idPrefix}-description-error`}
                        role="alert"
                        className="text-xs text-skrum-destructive-text"
                    >
                        {errors.description}
                    </p>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                <LoadingButton
                    type="submit"
                    loading={processing}
                    className="max-w-full"
                >
                    {t('Save')}
                </LoadingButton>
                <Button
                    type="button"
                    variant="outline"
                    className="max-w-full"
                    onClick={onDone}
                >
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}
