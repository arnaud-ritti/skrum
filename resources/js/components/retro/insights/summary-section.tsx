import { useState } from 'react';
import RetroSummariesController from '@/actions/App/Http/Controllers/Retros/RetroSummariesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from '../board-context';
import { SuggestionsList } from './suggestions-list';

export function SummarySection() {
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

    return (
        <section
            aria-labelledby="results-summary"
            className="space-y-3 rounded-lg border p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="results-summary" className="text-sm font-semibold">
                    {t('Summary')}
                </h2>
                {isFacilitator && summary.status !== 'pending' && (
                    <div className="flex gap-2">
                        {summary.status === null && (
                            <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void send(false)}
                            >
                                {t('Generate summary')}
                            </Button>
                        )}
                        {summary.status === 'failed' && (
                            <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void send(false)}
                            >
                                {t('Retry')}
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
                                    {t('Regenerate')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => void send(true)}
                                >
                                    {t('Remove')}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isFacilitator &&
                (summary.status === null || summary.status === 'failed') && (
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'The board content is sent to :provider to write the summary.',
                            { provider: summary.provider },
                        )}
                    </p>
                )}

            {summary.status === 'pending' && (
                <div className="space-y-2" aria-busy="true">
                    <p role="status" className="text-sm text-muted-foreground">
                        {t('Generating the summary…')}
                    </p>
                    <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse" />
                    <div className="h-3 w-4/5 rounded bg-muted motion-safe:animate-pulse" />
                    <div className="h-3 w-3/5 rounded bg-muted motion-safe:animate-pulse" />
                </div>
            )}

            {showsText && (
                <>
                    <p className="text-sm break-words whitespace-pre-wrap">
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
        </section>
    );
}
