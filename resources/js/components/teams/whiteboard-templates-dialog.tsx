import { router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import WorkspaceWhiteboardTemplatesController from '@/actions/App/Http/Controllers/WorkspaceWhiteboardTemplatesController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardTemplateSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    templates: WhiteboardTemplateSummary[];
};

function reloadTemplates() {
    router.reload({ only: ['whiteboardTemplates', 'whiteboardGallery'] });
}

export function WhiteboardTemplatesDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">{t('Whiteboard templates')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                <DialogTitle>{t('Whiteboard templates')}</DialogTitle>
                {open && <TemplatesManager {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function TemplatesManager({ workspaceSlug, templates }: Props) {
    const { t } = useTrans();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const remove = (template: WhiteboardTemplateSummary) => {
        router.delete(
            WorkspaceWhiteboardTemplatesController.destroy({
                workspace: workspaceSlug,
                whiteboardTemplate: template.id,
            }).url,
            {
                preserveScroll: true,
                onSuccess: () => setConfirmingId(null),
                onHttpException: () => {
                    setConfirmingId(null);
                    reloadTemplates();

                    return false;
                },
            },
        );
    };

    if (templates.length === 0) {
        return (
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                    {t('No whiteboard templates yet.')}
                </p>
                <p className="text-sm text-muted-foreground">
                    {t('Save a board as a template from its menu.')}
                </p>
            </div>
        );
    }

    return (
        <ul className="divide-y rounded-md border">
            {templates.map((template) => (
                <li key={template.id} className="space-y-2 p-3">
                    {editingId === template.id ? (
                        <TemplateEditForm
                            workspaceSlug={workspaceSlug}
                            template={template}
                            onDone={() => setEditingId(null)}
                        />
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-medium">
                                        {template.name}
                                    </p>
                                    {template.description && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {template.description}
                                        </p>
                                    )}
                                </div>
                                {template.canManage && (
                                    <div className="flex shrink-0 gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setEditingId(template.id)
                                            }
                                        >
                                            {t('Edit')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setConfirmingId(template.id)
                                            }
                                        >
                                            {t('Delete')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            {confirmingId === template.id && (
                                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm">
                                    <span>
                                        {t('Delete this template?')}{' '}
                                        {t(
                                            'Boards already created from it are not changed.',
                                        )}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => remove(template)}
                                    >
                                        {t('Delete')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setConfirmingId(null)}
                                    >
                                        {t('Cancel')}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </li>
            ))}
        </ul>
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

    const submit = (event: FormEvent) => {
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
                onError: (formErrors) => setErrors(formErrors),
                onHttpException: () => {
                    reloadTemplates();
                    onDone();

                    return false;
                },
            },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>{t('Name')}</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={name}
                    maxLength={80}
                    required
                    onChange={(event) => setName(event.target.value)}
                />
                <InputError message={errors.name} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-description`}>
                    {t('Description')}
                </Label>
                <Input
                    id={`${idPrefix}-description`}
                    value={description}
                    maxLength={300}
                    onChange={(event) => setDescription(event.target.value)}
                />
                <InputError message={errors.description} />
            </div>
            <div className="flex gap-2">
                <Button disabled={processing}>{t('Save')}</Button>
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}
