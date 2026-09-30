import { useState } from 'react';
import { toast } from 'sonner';
import RetroResultsEmailsController from '@/actions/App/Http/Controllers/Integrations/RetroResultsEmailsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, RetroResultsAudience } from '@/types';
import { useBoard } from '../board-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function EmailResultsDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [audience, setAudience] =
        useState<RetroResultsAudience>('participants');
    const [busy, setBusy] = useState(false);
    const counts = ctx.board.results?.emailRecipients ?? {
        participants: 0,
        team: 0,
    };
    const options: Array<{ value: RetroResultsAudience; label: string }> = [
        {
            value: 'participants',
            label: t('Participants with an account (:count)', {
                count: counts.participants,
            }),
        },
        {
            value: 'team',
            label: t('All team members (:count)', { count: counts.team }),
        },
    ];

    const send = async () => {
        setBusy(true);

        const delivery = await ctx.run(
            retroRequest<IntegrationDelivery>(
                RetroResultsEmailsController.store(ctx.board.retro.id),
                { audience },
            ),
        );

        setBusy(false);

        if (delivery === undefined) {
            return;
        }

        toast(t('The results are on their way.'));
        onOpenChange(false);
        await ctx.refetch();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Email the results')}</DialogTitle>
                <fieldset className="space-y-2">
                    <legend className="sr-only">{t('Recipients')}</legend>
                    {options.map((option) => (
                        <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm"
                        >
                            <input
                                type="radio"
                                name="results-audience"
                                value={option.value}
                                checked={audience === option.value}
                                onChange={() => setAudience(option.value)}
                                className="size-4 accent-primary"
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
                <p className="text-xs text-muted-foreground">
                    {t('Guests have no account and are never emailed.')}
                </p>
                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        disabled={busy || counts[audience] === 0}
                        onClick={() => void send()}
                    >
                        {t('Send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
