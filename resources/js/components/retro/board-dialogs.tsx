import { router } from '@inertiajs/react';
import { ListChecks } from 'lucide-react';
import { useId, useState } from 'react';
import RetroFacilitatorsController from '@/actions/App/Http/Controllers/Retros/RetroFacilitatorsController';
import RetrosController from '@/actions/App/Http/Controllers/Retros/RetrosController';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { isOpenStatus } from '@/lib/action-items/status';
import { retroRequest } from '@/lib/retro/api';
import { dashboard } from '@/routes';
import { useBoard } from './board-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/**
 * Sends a request for a dialog: a refusal is shown inside the dialog, which
 * stays open; an expired session closes it (the shell shows its banner).
 */
export function useDialogRequest(onOpenChange: (open: boolean) => void) {
    const ctx = useBoard();
    const [error, setError] = useState<string>();

    const send = async (request: () => Promise<unknown>): Promise<void> => {
        setError(undefined);

        try {
            await request();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message !== null) {
                setError(message);
            }

            throw caught;
        }
    };

    const change = (open: boolean) => {
        if (!open) {
            setError(undefined);
        }

        onOpenChange(open);
    };

    return { error, send, change };
}

export function HandoverDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const fieldId = useId();
    const [userId, setUserId] = useState('');
    const { error, send, change } = useDialogRequest(onOpenChange);
    const candidates = ctx.board.viewer.transferCandidates;
    // A candidate picked earlier who has left the list since is no choice.
    const chosen = candidates.some((candidate) => candidate.userId === userId)
        ? userId
        : '';
    const isOpen = open && !ctx.sessionExpired;

    if (candidates.length === 0) {
        return (
            <FormDialog
                open={isOpen}
                onOpenChange={change}
                title={t('Hand over facilitation')}
            >
                <p className="text-sm text-muted-foreground">
                    {t('No one else can facilitate this retrospective yet.')}
                </p>
            </FormDialog>
        );
    }

    return (
        <FormDialog
            open={isOpen}
            onOpenChange={change}
            title={t('Hand over facilitation')}
            submitLabel={t('Hand over')}
            error={error}
            submitDisabled={chosen === ''}
            onSubmit={async () => {
                await send(() =>
                    retroRequest(
                        RetroFacilitatorsController.update(ctx.board.retro.id),
                        { user_id: chosen },
                    ),
                );
                await ctx.refetch();
            }}
        >
            <div className="grid gap-2">
                <Label htmlFor={fieldId}>{t('New facilitator')}</Label>
                <Select
                    name="user_id"
                    required
                    value={chosen}
                    onValueChange={setUserId}
                >
                    <SelectTrigger id={fieldId} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((candidate) => (
                            <SelectItem
                                key={candidate.userId}
                                value={candidate.userId}
                            >
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={candidate.name}
                                    src={candidate.avatarUrl}
                                />
                                <span className="truncate">
                                    {candidate.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </FormDialog>
    );
}

export function DeleteRetroDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { error, send, change } = useDialogRequest(onOpenChange);
    const openItems = ctx.board.actionItems.filter((item) =>
        isOpenStatus(item.status),
    ).length;

    return (
        <ConfirmDialog
            open={open && !ctx.sessionExpired}
            onOpenChange={change}
            tone="destructive"
            title={t('Delete retrospective')}
            description={t(
                'Delete this retrospective? Everyone loses access to it.',
            )}
            consequences={
                openItems === 0
                    ? undefined
                    : [
                          {
                              icon: ListChecks,
                              label:
                                  openItems === 1
                                      ? t(
                                            'This also deletes 1 open action item.',
                                        )
                                      : t(
                                            'This also deletes :count open action items.',
                                            { count: openItems },
                                        ),
                          },
                      ]
            }
            confirmLabel={t('Delete')}
            error={error}
            onConfirm={async () => {
                await send(() =>
                    retroRequest(RetrosController.destroy(ctx.board.retro.id)),
                );

                router.visit(ctx.board.links.team ?? dashboard().url);
            }}
        />
    );
}
