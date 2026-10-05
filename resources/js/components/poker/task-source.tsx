import {
    Check,
    CircleAlert,
    CircleCheck,
    Clock,
    RefreshCw,
    SearchX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import PokerTaskSyncsController from '@/actions/App/Http/Controllers/Integrations/PokerTaskSyncsController';
import { ProviderMark } from '@/components/skrum/provider-mark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    type PokerTask,
    type PokerTaskExternal,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { EstimateConflict } from './estimate-conflict';
import { useGame } from './game-context';

/** The ticket of the design system: the key of an issue, in mono, on the muted surface. */
export const TicketClasses =
    'min-h-5 gap-1 rounded-xs border-border bg-muted px-1.5 font-mono font-medium text-foreground';

/** The key of the ticket on a row of the queue. */
export function TaskSourceChip({ external }: { external: PokerTaskExternal }) {
    const { t } = useTrans();

    return (
        <Badge variant="outline" className={TicketClasses}>
            {external.statusCategory === 'done' && (
                <CircleCheck
                    role="img"
                    className="text-skrum-success-text"
                    aria-label={t('Done in :source', {
                        source: TrackerLabels[external.source],
                    })}
                />
            )}
            <ProviderMark provider={external.source} className="size-3" />
            {external.key}
        </Badge>
    );
}

/** The key of the ticket on the story: it opens the issue in its tracker. */
export function TaskSourceLink({ external }: { external: PokerTaskExternal }) {
    const { t } = useTrans();

    return (
        <Badge asChild variant="outline" className={TicketClasses}>
            <a
                href={external.url}
                target="_blank"
                rel="noopener noreferrer"
                data-slot="ticket"
                aria-label={`${external.key}, ${t('Open in :source', {
                    source: TrackerLabels[external.source],
                })}`}
            >
                <ProviderMark provider={external.source} className="size-3" />
                {external.key}
            </a>
        </Badge>
    );
}

type Props = { task: PokerTask; external: PokerTaskExternal };

/** What the tracker says of the task: who has it, its estimate there, and whether the estimate of the game reached it. */
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

    const hasFacts =
        Boolean(external.assignee) ||
        Boolean(external.sourceEstimate) ||
        Boolean(external.syncState) ||
        Boolean(external.status) ||
        external.statusCategory === 'done' ||
        external.missing === true;

    return (
        <div data-slot="task-source" className="flex min-w-0 flex-col gap-2">
            {hasFacts && (
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-muted-foreground">
                    {external.assignee && (
                        <span className="min-w-0 break-words">
                            {t('Assignee: :name', { name: external.assignee })}
                        </span>
                    )}
                    {external.sourceEstimate && (
                        <span className="min-w-0 break-words">
                            {t(':source estimate: :value', {
                                source,
                                value: external.sourceEstimate,
                            })}
                        </span>
                    )}
                    <SyncBadge external={external} source={source} />
                    {external.statusCategory === 'done' && (
                        <Badge variant="success" icon={CircleCheck}>
                            {t('Done in :source', { source })}
                        </Badge>
                    )}
                    {external.statusCategory !== 'done' && external.status && (
                        <Badge variant="outline">
                            {t(':status in :source', {
                                status: external.status,
                                source,
                            })}
                        </Badge>
                    )}
                    {external.missing && (
                        <Badge variant="destructive" icon={SearchX}>
                            {t('Not found in :source', { source })}
                        </Badge>
                    )}
                    {canSync && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-w-0"
                            disabled={busy}
                            onClick={() => void sync()}
                        >
                            <RefreshCw
                                aria-hidden
                                className={cn(
                                    busy &&
                                        'animate-spin motion-reduce:animate-none',
                                )}
                            />
                            <span className="truncate">
                                {external.syncState === 'synced'
                                    ? t('Sync again')
                                    : t('Retry')}
                            </span>
                        </Button>
                    )}
                </div>
            )}
            {external.estimateConflict && (
                <EstimateConflict
                    task={task}
                    conflict={external.estimateConflict}
                    source={source}
                />
            )}
            {external.syncState === 'failed' && external.syncError && (
                <p className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text">
                    <CircleAlert
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0 break-words">
                        {external.syncError}
                    </span>
                </p>
            )}
            <p className="text-xs text-muted-foreground">
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
    const hint =
        external.source === 'github'
            ? t('Written to the issue description.')
            : undefined;
    /** The title is for the pointer; the text reaches screen readers too. */
    const spokenHint = hint && <span className="sr-only">{` ${hint}`}</span>;

    switch (external.syncState) {
        case 'synced':
            return (
                <Badge variant="success" icon={Check} title={hint}>
                    {t('Synced to :source', { source })}
                    {spokenHint}
                </Badge>
            );
        case 'pending':
            return (
                <Badge variant="muted" icon={Clock} title={hint}>
                    {t('Sync pending')}
                    {spokenHint}
                </Badge>
            );
        case 'failed':
            return (
                <Badge variant="destructive" icon={CircleAlert} title={hint}>
                    {t('Sync failed')}
                    {spokenHint}
                </Badge>
            );
        case 'unsupported':
            return (
                <Badge
                    variant="outline"
                    className="min-w-0 shrink py-0.5 whitespace-normal"
                >
                    {t('Not synced: :reason', {
                        reason: external.unsupportedReason ?? '',
                    })}
                </Badge>
            );
        default:
            return null;
    }
}
