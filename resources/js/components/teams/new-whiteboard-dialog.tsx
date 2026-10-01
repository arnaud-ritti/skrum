import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
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
import { useTrans } from '@/hooks/use-trans';

type Props = { workspaceSlug: string; teamId: string };

export function NewWhiteboardDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New whiteboard')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                {open && <NewWhiteboardForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function NewWhiteboardForm({ workspaceSlug, teamId }: Props) {
    const { t } = useTrans();
    const form = useForm({ title: '' });

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
            <DialogFooter>
                <Button disabled={form.processing}>{t('Create')}</Button>
            </DialogFooter>
        </form>
    );
}
