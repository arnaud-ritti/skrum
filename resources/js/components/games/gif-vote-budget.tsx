import { useId } from 'react';
import { VoteBudget } from '@/components/skrum/vote-dots';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = {
    round: GameRound;
    className?: string;
};

/**
 * "Your votes" while the GIFs are voted on, when the round gives more than one
 * vote; a one-vote round keeps its "Favourite" wording instead.
 */
export function GifVoteBudget({ round, className }: Props) {
    const { t } = useTrans();
    const titleId = useId();
    const allowed = round.votesAllowed ?? 1;

    if (round.revealedAt === null || allowed <= 1) {
        return null;
    }

    const used = Math.min((round.myVotes ?? []).length, allowed);

    return (
        <section
            data-slot="gif-vote-budget"
            aria-labelledby={titleId}
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex min-w-0 items-center justify-between gap-2">
                <h2 id={titleId} className="text-base font-title">
                    {t('Your votes')}
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t(':count / :total used', { count: used, total: allowed })}
                </span>
            </div>
            <VoteBudget
                total={allowed}
                remaining={allowed - used}
                className="self-start"
            />
        </section>
    );
}
