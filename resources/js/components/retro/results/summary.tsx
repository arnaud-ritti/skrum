import { useState } from 'react';
import RetroSummariesController from '@/actions/App/Http/Controllers/Retros/RetroSummariesController';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from '../board-context';
import { SuggestionsList } from '../suggestions-list';
import { ResultsCard } from './results-card';

/**
 * The summary written by the language model, with the themes and the
 * suggested actions. Only the facilitator generates, regenerates or removes
 * it.
 */
export function Summary() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const summary = ctx.board.results?.summary ?? null;
    const insights = ctx.board.insights;
    const isFacilitator = ctx.board.viewer.isFacilitator;

    if (summary === null) {
        return null;
    }

    const hasInsights =
        insights !== null &&
        (insights.themes.length > 0 || insights.suggestedActions.length > 0);
    const showsText = summary.status === 'ready' && summary.text !== null;

    if (
        !isFacilitator &&
        summary.status !== 'pending' &&
        !showsText &&
        !hasInsights
    ) {
        return null;
    }

    const send = async (remove: boolean) => {
        if (busy) {
            return;
        }

        setBusy(true);
        const result = await ctx.run(
            retroRequest(
                remove
                    ? RetroSummariesController.destroy(ctx.board.retro.id)
                    : RetroSummariesController.store(ctx.board.retro.id),
            ),
        );
        setBusy(false);

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    const canAct = isFacilitator && summary.status !== 'pending';

    return (
        <ResultsCard
            title={t('Summary')}
            titleId="results-summary"
            aside={
                canAct ? (
                    <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-2">
                        {summary.status === null && (
                            <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void send(false)}
                            >
                                <span className="truncate">
                                    {t('Generate summary')}
                                </span>
                            </Button>
                        )}
                        {summary.status === 'failed' && (
                            <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void send(false)}
                            >
                                <span className="truncate">{t('Retry')}</span>
                            </Button>
                        )}
                        {summary.status === 'ready' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => void send(false)}
                                >
                                    <span className="truncate">
                                        {t('Regenerate')}
                                    </span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => void send(true)}
                                >
                                    <span className="truncate">
                                        {t('Remove')}
                                    </span>
                                </Button>
                            </>
                        )}
                    </div>
                ) : undefined
            }
        >
            {isFacilitator &&
                (summary.status === null || summary.status === 'failed') && (
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'The board content is sent to :provider to write the summary.',
                            { provider: summary.provider },
                        )}
                    </p>
                )}

            {/* Mounted before its text: a live region inserted filled is often not announced. */}
            <p
                role="status"
                className={cn(
                    'text-sm text-muted-foreground',
                    summary.status !== 'pending' && 'sr-only',
                )}
            >
                {summary.status === 'pending' && t('Generating the summary…')}
            </p>
            {summary.status === 'pending' && (
                <div className="flex flex-col gap-2" aria-busy="true">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                </div>
            )}

            {showsText && (
                <>
                    <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                        {summary.text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t('Generated with :provider', {
                            provider: summary.provider,
                        })}
                    </p>
                </>
            )}

            {summary.status === 'failed' && isFacilitator && (
                <p className="text-sm text-muted-foreground">
                    {t('The summary could not be generated')}
                </p>
            )}

            {hasInsights && <SuggestionsList />}
        </ResultsCard>
    );
}
