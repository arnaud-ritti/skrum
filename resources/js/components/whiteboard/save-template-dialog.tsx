import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import WhiteboardTemplatesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTemplatesController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';

type Props = {
    boardId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type FieldErrors = { name?: string; description?: string };

export function SaveTemplateDialog({ boardId, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                {open && (
                    <SaveTemplateForm
                        boardId={boardId}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SaveTemplateForm({
    boardId,
    onClose,
}: {
    boardId: string;
    onClose: () => void;
}) {
    const { t } = useTrans();
    const nameId = useId();
    const descriptionId = useId();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        setErrors({});

        try {
            await retroRequest(WhiteboardTemplatesController.store(boardId), {
                name,
                description: description === '' ? null : description,
            });
            toast.success(t('Template saved.'));
            onClose();
        } catch (error) {
            const fieldErrors = fieldErrorsOf(error);

            if (fieldErrors) {
                setErrors(fieldErrors);

                return;
            }

            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setSaving(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void save();
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Save as template')}</DialogTitle>
            <DialogDescription>
                {t('Everyone in the workspace can start a board from it.')}
            </DialogDescription>
            <div className="space-y-2">
                <Label htmlFor={nameId}>{t('Name')}</Label>
                <Input
                    id={nameId}
                    required
                    maxLength={80}
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <InputError message={errors.name} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={descriptionId}>{t('Description')}</Label>
                <Input
                    id={descriptionId}
                    maxLength={300}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                />
                <InputError message={errors.description} />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button disabled={saving}>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}

/** Null when the refusal is not about a field of the form, so the caller says it in a toast. */
function fieldErrorsOf(error: unknown): FieldErrors | null {
    if (!(error instanceof RetroRequestError) || error.status !== 422) {
        return null;
    }

    const name = error.errors.name?.[0];
    const description = error.errors.description?.[0];

    if (!name && !description) {
        return null;
    }

    return { name, description };
}
