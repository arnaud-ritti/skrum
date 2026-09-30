import { ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import PokerTaskSyncsController from '@/actions/App/Http/Controllers/Integrations/PokerTaskSyncsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    type PokerTask,
    type PokerTaskExternal,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = { task: PokerTask; external: PokerTaskExternal };

export function TaskSourceDetails({ task, external }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const source = TrackerLabels[external.source];
    const canSync =
        snapshot.me.isFacilitator &&
        task.estimate !== null &&
        (external.syncState === 'failed' ||
            external.syncState === 'pending' ||
            external.syncState === 'synced');

    const sync = async () => {
        setBusy(true);

        const result = await run(
            retroRequest<PokerTask>(
                PokerTaskSyncsController.store({
                    game: snapshot.game.id,
                    task: task.id,
                }),
            ),
        );

        setBusy(false);

        if (result) {
            apply({ type: 'task.upsert', task: result });
            toast.success(t('Sync requested.'));
        }
    };

    return (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <a
                    href={external.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-medium underline"
                >
                    {external.key}
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">
                        {t('Open in :source', { source })}
                    </span>
                </a>
                {external.assignee && (
                    <span>
                        {t('Assignee: :name', { name: external.assignee })}
                    </span>
                )}
                {external.sourceEstimate && (
                    <span>
                        {t(':source estimate: :value', {
                            source,
                            value: external.sourceEstimate,
                        })}
                    </span>
                )}
                <SyncBadge external={external} source={source} />
                {canSync && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void sync()}
                    >
                        <RefreshCw className="size-3.5" />
                        {external.syncState === 'synced'
                            ? t('Sync again')
                            : t('Retry')}
                    </Button>
                )}
            </div>
            {external.syncState === 'failed' && external.syncError && (
                <p className="text-destructive">{external.syncError}</p>
            )}
            <p className="text-muted-foreground">
                {t(
                    'The title and description are managed in :source. Refresh the tasks to update them.',
                    { source },
                )}
            </p>
        </div>
    );
}

function SyncBadge({
    external,
    source,
}: {
    external: PokerTaskExternal;
    source: string;
}) {
    const { t } = useTrans();

    switch (external.syncState) {
        case 'synced':
            return (
                <Badge variant="secondary">
                    {t('Synced to :source', { source })}
                </Badge>
            );
        case 'pending':
            return <Badge variant="outline">{t('Sync pending')}</Badge>;
        case 'failed':
            return <Badge variant="destructive">{t('Sync failed')}</Badge>;
        case 'unsupported':
            return (
                <Badge variant="outline" className="whitespace-normal">
                    {t('Not synced: :reason', {
                        reason: external.unsupportedReason ?? '',
                    })}
                </Badge>
            );
        default:
            return null;
    }
}
