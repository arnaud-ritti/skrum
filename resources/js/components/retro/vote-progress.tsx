import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';

export function VoteProgress({ board }: { board: Snapshot }) {
    const { t } = useTrans();
    const total = board.participants.length * board.retro.votesPerParticipant;
    const cast = board.votesCast ?? 0;
    const percentage = total === 0 ? 0 : Math.min(100, (cast / total) * 100);

    return (
        <div className="flex items-center gap-3 text-sm">
            <span>
                {t('Votes left: :count', {
                    count: board.viewer.remainingVotes,
                })}
            </span>
            <div
                className="h-2 w-32 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={cast}
                aria-label={t('Votes cast')}
            >
                <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-muted-foreground">
                {t(
                    cast === 1
                        ? ':cast of :total vote cast'
                        : ':cast of :total votes cast',
                    { cast, total },
                )}
            </span>
        </div>
    );
}
