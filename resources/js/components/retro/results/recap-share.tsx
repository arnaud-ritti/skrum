import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import RetroSharesController from '@/actions/App/Http/Controllers/Integrations/RetroSharesController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';
import { recapDialogTitle } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationDelivery, ShareChannel } from '@/types';
import { useDialogRequest } from '../board-dialogs';
import { useBoard } from '../board-context';

type Props = {
    channel: ShareChannel | null;
    onClose: () => void;
};

/** Says what the recap holds before it is posted to a chat channel. */
export function RecapShareDialog({ channel, onClose }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { error, send, change } = useDialogRequest((open) => {
        if (!open) {
            onClose();
        }
    });
    const { retro, results } = ctx.board;
    const summaryStatus = results?.summary?.status ?? null;

    return (
        <FormDialog
            open={channel !== null && !ctx.sessionExpired}
            onOpenChange={change}
            title={channel === null ? '' : recapDialogTitle(channel, t)}
            description={t('The recap includes:')}
            submitLabel={t('Send')}
            error={error}
            onSubmit={async () => {
                if (channel === null) {
                    return;
                }

                await send(() =>
                    retroRequest<IntegrationDelivery>(
                        RetroSharesController.store(retro.id),
                        { channel, kind: 'results' },
                    ),
                );
                toast(t('The message is on its way.'));
                await ctx.refetch();
            }}
        >
            <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>{t('Title, date and participants')}</li>
                <li>{t('Number of cards and ROTI average')}</li>
                {summaryStatus === 'ready' && <li>{t('The summary')}</li>}
                <li>{t('Action items with their assignees')}</li>
                <li>{t('Pending suggested actions')}</li>
                <li>{t('The top card of each column')}</li>
            </ul>
            {summaryStatus === 'pending' && (
                <p className="flex min-w-0 items-start gap-2 rounded-md bg-skrum-warning-soft px-3 py-2 text-sm text-skrum-warning-text">
                    <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                    />
                    <span className="min-w-0">
                        {t(
                            'The summary is still being generated and will not be included.',
                        )}
                    </span>
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
        </FormDialog>
    );
}
