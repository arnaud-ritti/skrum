import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import WhiteboardTemplatesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardTemplatesController';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { dashboard } from '@/routes';
import { formText } from '@/lib/utils';

export const TitleMaxLength = 120;
const TemplateNameMaxLength = 80;
const TemplateDescriptionMaxLength = 300;
const NewFacilitatorId = 'whiteboard-new-facilitator';

type DialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type BoardDialogProps = DialogProps & { state: WhiteboardState };

type TemplateFieldErrors = { name?: string; description?: string };

/**
 * Runs the request of a dialog. A refusal becomes the dialog's error and is
 * thrown again, so the dialog stays open on it.
 */
function useDialogRequest(onOpenChange: (open: boolean) => void) {
    const { t } = useTrans();
    const [error, setError] = useState<string>();

    const attempt = async <T,>(request: () => Promise<T>): Promise<T> => {
        setError(undefined);

        try {
            return await request();
        } catch (refusal) {
            setError(
                refusal instanceof RetroRequestError &&
                    refusal.status > 0 &&
                    refusal.status < 500
                    ? refusal.message
                    : t('Something went wrong. Please try again.'),
            );

            throw refusal;
        }
    };

    const changeOpen = (open: boolean): void => {
        if (!open) {
            setError(undefined);
        }

        onOpenChange(open);
    };

    return { error, setError, attempt, changeOpen };
}

export function RenameBoardDialog({
    state,
    open,
    onOpenChange,
}: BoardDialogProps) {
    const { t } = useTrans();
    const { board } = state.snapshot;
    const { error, attempt, changeOpen } = useDialogRequest(onOpenChange);

    const rename = async (data: FormData): Promise<void> => {
        await attempt(() =>
            retroRequest(WhiteboardSettingsController.update(board.id), {
                title: formText(data, 'title'),
            }),
        );

        await state.refetch();
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={changeOpen}
            title={t('Rename')}
            submitLabel={t('Save')}
            onSubmit={rename}
            error={error}
        >
            <TextField
                label={t('Title')}
                name="title"
                required
                autoFocus
                maxLength={TitleMaxLength}
                defaultValue={board.title}
                onFocus={(event) => event.target.select()}
            />
        </FormDialog>
    );
}

/** Null when the refusal is not about a field of the form, so the dialog says it above its footer. */
function templateFieldErrorsOf(refusal: unknown): TemplateFieldErrors | null {
    if (!(refusal instanceof RetroRequestError) || refusal.status !== 422) {
        return null;
    }

    const name = refusal.errors.name?.[0];
    const description = refusal.errors.description?.[0];

    if (!name && !description) {
        return null;
    }

    return { name, description };
}

export function SaveTemplateDialog({
    boardId,
    open,
    onOpenChange,
}: DialogProps & { boardId: string }) {
    const { t } = useTrans();
    const { error, setError, attempt, changeOpen } =
        useDialogRequest(onOpenChange);
    const [fieldErrors, setFieldErrors] = useState<TemplateFieldErrors>({});

    const save = async (data: FormData): Promise<void> => {
        const description = formText(data, 'description');

        setFieldErrors({});

        try {
            await attempt(() =>
                retroRequest(WhiteboardTemplatesController.store(boardId), {
                    name: formText(data, 'name'),
                    description: description === '' ? null : description,
                }),
            );
        } catch (refusal) {
            const refused = templateFieldErrorsOf(refusal);

            if (refused !== null) {
                setError(undefined);
                setFieldErrors(refused);
            }

            throw refusal;
        }

        toast.success(t('Template saved.'));
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setFieldErrors({});
                }

                changeOpen(next);
            }}
            title={t('Save as template')}
            description={t(
                'Everyone in the workspace can start a board from it.',
            )}
            submitLabel={t('Save')}
            onSubmit={save}
            error={error}
        >
            <TextField
                label={t('Name')}
                name="name"
                required
                autoFocus
                maxLength={TemplateNameMaxLength}
                error={fieldErrors.name}
            />
            <TextField
                label={t('Description')}
                name="description"
                maxLength={TemplateDescriptionMaxLength}
                error={fieldErrors.description}
            />
        </FormDialog>
    );
}

export function HandOverDialog({
    state,
    open,
    onOpenChange,
}: BoardDialogProps) {
    const { t } = useTrans();
    const { board, me } = state.snapshot;
    const candidates = me.transferCandidates;
    const { error, attempt, changeOpen } = useDialogRequest(onOpenChange);
    const [userId, setUserId] = useState('');

    const close = (next: boolean): void => {
        if (!next) {
            setUserId('');
        }

        changeOpen(next);
    };

    const handOver = async (): Promise<void> => {
        await attempt(() =>
            retroRequest(WhiteboardFacilitatorsController.update(board.id), {
                user_id: userId,
            }),
        );

        await state.refetch();
    };

    if (candidates.length === 0) {
        return (
            <FormDialog
                open={open}
                onOpenChange={close}
                title={t('Hand over facilitation')}
            >
                <p className="text-sm text-muted-foreground">
                    {t('No one else can facilitate this board yet.')}
                </p>
            </FormDialog>
        );
    }

    return (
        <FormDialog
            open={open}
            onOpenChange={close}
            title={t('Hand over facilitation')}
            submitLabel={t('Hand over')}
            submitDisabled={userId === ''}
            onSubmit={handOver}
            error={error}
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={NewFacilitatorId}>{t('New facilitator')}</Label>
                <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id={NewFacilitatorId} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((candidate) => (
                            <SelectItem
                                key={candidate.userId}
                                value={candidate.userId}
                            >
                                {candidate.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </FormDialog>
    );
}

export function DeleteBoardDialog({
    state,
    open,
    onOpenChange,
}: BoardDialogProps) {
    const { t } = useTrans();
    const { board, links } = state.snapshot;
    const { error, attempt, changeOpen } = useDialogRequest(onOpenChange);

    const deleteBoard = async (): Promise<void> => {
        await attempt(() =>
            retroRequest(WhiteboardsController.destroy(board.id)),
        );

        router.visit(links.team ?? dashboard().url);
    };

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={changeOpen}
            title={t('Delete this board?')}
            description={t('Everything on it is removed for everyone.')}
            confirmLabel={t('Delete this board')}
            tone="destructive"
            onConfirm={deleteBoard}
            error={error}
        />
    );
}
