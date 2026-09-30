import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import { useGame } from './game-context';

export function ResultPanel({ round }: { round: PokerRound }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { result } = round;

    if (result === null) {
        return null;
    }

    const highest = Math.max(1, ...result.distribution.map((row) => row.count));
    const hasCountable = result.average !== null || result.mode.length > 0;

    return (
        <section
            aria-labelledby="poker-result"
            className="space-y-3 rounded-md border p-4"
        >
            <div className="flex flex-wrap items-center gap-3">
                <h2 id="poker-result" className="font-semibold">
                    {t('Result')}
                </h2>
                {result.consensus && <Badge>{t('Consensus')}</Badge>}
            </div>
            {round.revealReason === 'everyone_voted' && (
                <p className="text-sm text-muted-foreground">
                    {t('Revealed automatically — everyone voted')}
                </p>
            )}
            {round.revealReason === 'timer' && (
                <p className="text-sm text-muted-foreground">
                    {t("Revealed automatically — time's up")}
                </p>
            )}

            {!hasCountable ? (
                <p className="text-sm text-muted-foreground">
                    {t('No countable votes')}
                </p>
            ) : snapshot.game.isNumeric && result.average !== null ? (
                <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span>
                        {t('Average')}:{' '}
                        <span className="text-2xl font-semibold">
                            {formatAverage(result.average, locale)}
                        </span>
                    </span>
                    {result.nearestCard !== null && (
                        <span className="text-muted-foreground">
                            {t('Nearest card: :card', {
                                card: result.nearestCard,
                            })}
                        </span>
                    )}
                </p>
            ) : (
                <p>
                    {t('Most played: :cards', {
                        cards: result.mode.join(', '),
                    })}
                </p>
            )}

            <ul className="space-y-1">
                {result.distribution.map((row) => (
                    <li
                        key={row.value}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span className="w-10 text-right font-mono font-semibold">
                            {row.value}
                        </span>
                        <span
                            className="h-3 rounded bg-primary"
                            style={{ width: `${(row.count / highest) * 70}%` }}
                            aria-hidden="true"
                        />
                        <span className="text-muted-foreground">
                            {row.count}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
