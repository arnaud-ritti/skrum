import { useState } from 'react';
import { toast } from 'sonner';
import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { recapDialogTitle } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useBoard } from '../board-context';

type Props = {
    channel: ShareChannel | null;
    onClose: () => void;
};

export function RecapShareDialog({ channel, onClose }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { retro, results } = ctx.board;
    const summaryStatus = results?.summary?.status ?? null;

    const send = async () => {
        if (channel === null) {
            return;
        }

        setBusy(true);

        let delivery: IntegrationDelivery | undefined;

        try {
            delivery = await ctx.run(
                retroRequest<IntegrationDelivery>(
                    RetroSharesController.store(retro.id),
                    { channel, kind: 'results' },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (delivery === undefined) {
            return;
        }

        toast(t('The message is on its way.'));
        onClose();
        await ctx.refetch();
    };

    return (
        <Dialog
            open={channel !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>
                    {channel === null ? null : recapDialogTitle(channel, t)}
                </DialogTitle>
                <DialogDescription>
                    {t('The recap includes:')}
                </DialogDescription>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                    <li>{t('Title, date and participants')}</li>
                    <li>{t('Number of cards and ROTI average')}</li>
                    {summaryStatus === 'ready' && <li>{t('The summary')}</li>}
                    <li>{t('Action items with their assignees')}</li>
                    <li>{t('Pending suggested actions')}</li>
                    <li>{t('The top card of each column')}</li>
                </ul>
                {summaryStatus === 'pending' && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        {t(
                            'The summary is still being generated and will not be included.',
                        )}
                    </p>
                )}
                {retro.isAnonymous && (
                    <p className="text-sm">
                        {t(
                            'Participants are shown as a count. Action items are shown with names.',
                        )}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    {t('Card authors, votes and comments are never shared.')}
                </p>
                <DialogFooter className="gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button disabled={busy} onClick={() => void send()}>
                        {t('Send')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
