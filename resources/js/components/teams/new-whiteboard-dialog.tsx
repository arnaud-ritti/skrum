import { router, useForm } from '@inertiajs/react';
import { useEffect, useState, type FormEvent } from 'react';
import TeamWhiteboardsController from '@/actions/App/Http/Controllers/TeamWhiteboardsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { WhiteboardGalleryItem } from '@/types';
import { WhiteboardTemplatePreview } from './whiteboard-template-preview';

type Props = {
    workspaceSlug: string;
    teamId: string;
    gallery?: WhiteboardGalleryItem[];
};

type WhiteboardForm = {
    title: string;
    template: string | null;
    workspace_template_id: string | null;
};

export function NewWhiteboardDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New whiteboard')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
            >
                {open && <NewWhiteboardForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function NewWhiteboardForm({ workspaceSlug, teamId, gallery }: Props) {
    const { t } = useTrans();
    const form = useForm<WhiteboardForm>({
        title: '',
        template: 'blank',
        workspace_template_id: null,
    });
    const builtIns = (gallery ?? []).filter(
        (item) => item.workspaceTemplateId === null,
    );
    const workspaceTemplates = (gallery ?? []).filter(
        (item) => item.workspaceTemplateId !== null,
    );

    useEffect(() => {
        if (gallery === undefined) {
            router.reload({ only: ['whiteboardGallery'] });
        }
    }, [gallery]);

    const isSelected = (item: WhiteboardGalleryItem) =>
        item.workspaceTemplateId === null
            ? form.data.template === item.key
            : form.data.workspace_template_id === item.workspaceTemplateId;

    const select = (item: WhiteboardGalleryItem) =>
        form.setData((data) => ({
            ...data,
            template: item.workspaceTemplateId ? null : item.key,
            workspace_template_id: item.workspaceTemplateId,
        }));

    const renderTile = (item: WhiteboardGalleryItem) => (
        <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={isSelected(item)}
            onClick={() => select(item)}
            className={cn(
                'flex flex-col gap-2 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected(item) && 'ring-2 ring-primary',
            )}
        >
            <WhiteboardTemplatePreview preview={item.preview} />
            <span className="px-1 pb-1">
                <span className="block font-medium">{item.name}</span>
                {item.description && (
                    <span className="line-clamp-2 block text-sm text-muted-foreground">
                        {item.description}
                    </span>
                )}
            </span>
        </button>
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.submit(
            TeamWhiteboardsController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New whiteboard')}</DialogTitle>
            <div className="grid gap-2">
                <Label htmlFor="whiteboard-title">{t('Title')}</Label>
                <Input
                    id="whiteboard-title"
                    required
                    maxLength={120}
                    autoFocus
                    value={form.data.title}
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
                <InputError message={form.errors.title} />
            </div>
            <fieldset className="space-y-3">
                <legend className="text-sm font-medium">{t('Template')}</legend>
                {gallery === undefined && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Array.from({ length: 6 }, (_, index) => (
                            <Skeleton key={index} className="h-36" />
                        ))}
                    </div>
                )}
                {gallery !== undefined && (
                    <div
                        role="radiogroup"
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    >
                        {builtIns.map(renderTile)}
                    </div>
                )}
                {workspaceTemplates.length > 0 && (
                    <>
                        <p className="text-sm font-medium text-muted-foreground">
                            {t('Workspace templates')}
                        </p>
                        <div
                            role="radiogroup"
                            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                        >
                            {workspaceTemplates.map(renderTile)}
                        </div>
                    </>
                )}
                <InputError
                    message={
                        form.errors.template ??
                        form.errors.workspace_template_id
                    }
                />
            </fieldset>
            <DialogFooter>
                <Button disabled={form.processing}>{t('Create')}</Button>
            </DialogFooter>
        </form>
    );
}
