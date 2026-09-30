import { useTrans } from '@/hooks/use-trans';
import type { PokerRound } from '@/lib/poker/types';

/**
 * Revealed votes of a round. An anonymous round lists only the values from
 * the distribution, never next to a player's name.
 */
export function RoundVotes({
    round,
    nameOf,
}: {
    round: PokerRound;
    nameOf: (playerId: string) => string;
}) {
    const { t } = useTrans();

    if (round.anonymous) {
        return (
            <div className="mt-1 space-y-1">
                <p className="text-muted-foreground">{t('Anonymous votes')}</p>
                <ul className="flex flex-wrap gap-2">
                    {(round.result?.distribution ?? []).map((entry) => (
                        <li
                            key={entry.value}
                            className="rounded border px-2 py-0.5 font-mono font-semibold"
                        >
                            {entry.value} × {entry.count}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {round.votes.map((vote) => (
                <li key={vote.playerId}>
                    {nameOf(vote.playerId)}:{' '}
                    <span className="font-mono font-semibold">
                        {vote.value ?? '—'}
                    </span>
                </li>
            ))}
        </ul>
    );
}
