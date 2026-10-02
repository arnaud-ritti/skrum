import { useState } from 'react';
import { toast } from 'sonner';
import RetroResultsEmailsController from '@/actions/App/Http/Controllers/Integrations/RetroResultsEmailsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { RadioGroup } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, RetroResultsAudience } from '@/types';
import { useDialogRequest } from '../board-dialogs';
import { useBoard } from '../board-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const Audiences: RetroResultsAudience[] = ['participants', 'team'];

/** Sends the recap by e-mail to the participants or to the whole team. */
export function RecapEmailDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<RetroResultsAudience>('participants');
    const { error, send, change } = useDialogRequest(onOpenChange);
    const counts = ctx.board.results?.emailRecipients ?? {
        participants: 0,
        team: 0,
    };
    const reachable = Audiences.filter((audience) => counts[audience] > 0);
    const audience = reachable.includes(chosen) ? chosen : reachable[0];
    const labels: Record<RetroResultsAudience, string> = {
        participants: t('Participants with an account (:count)', {
            count: counts.participants,
        }),
        team: t('All team members (:count)', { count: counts.team }),
    };
    const body = (
        <>
            <RadioGroup<RetroResultsAudience>
                aria-label={t('Recipients')}
                value={audience}
                onValueChange={setChosen}
                options={Audiences.map((value) => ({
                    value,
                    label: labels[value],
                    disabled: counts[value] === 0,
                }))}
            />
            <p className="text-xs text-muted-foreground">
                {t('Guests have no account and are never emailed.')}
            </p>
        </>
    );
    const isOpen = open && !ctx.sessionExpired;

    if (audience === undefined) {
        return (
            <FormDialog
                open={isOpen}
                onOpenChange={change}
                title={t('Email the results')}
            >
                {body}
            </FormDialog>
        );
    }

    return (
        <FormDialog
            open={isOpen}
            onOpenChange={change}
            title={t('Email the results')}
            submitLabel={t('Send')}
            error={error}
            onSubmit={async () => {
                await send(() =>
                    retroRequest<IntegrationDelivery>(
                        RetroResultsEmailsController.store(ctx.board.retro.id),
                        { audience },
                    ),
                );
                toast(t('The results are on their way.'));
                await ctx.refetch();
            }}
        >
            {body}
        </FormDialog>
    );
}
