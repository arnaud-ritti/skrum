import { useState } from 'react';
import PokerVotesController from '@/actions/App/Http/Controllers/Poker/PokerVotesController';
import { useTrans } from '@/hooks/use-trans';
import type { PokerVoteResponse } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { PokerCard } from './poker-card';

export function Hand() {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { game, me, current } = snapshot;
    const round = current?.round ?? null;

    if (!me.canVote) {
        return (
            <p className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 text-center text-sm text-muted-foreground">
                {t("You're watching — switch to Play to vote")}
            </p>
        );
    }

    const isClosed =
        round === null || round.revealedAt !== null || game.endedAt !== null;

    const play = async (card: string) => {
        if (round === null) {
            return;
        }

        const withdraws = round.myVote === card;
        const route = { game: game.id, round: round.id };
        const countChange = withdraws ? -1 : round.myVote === null ? 1 : 0;

        setBusy(true);
        apply({
            type: 'vote.mine',
            response: {
                roundId: round.id,
                myVote: withdraws ? null : card,
                votesCount: round.votesCount + countChange,
                version: round.version,
                revealed: false,
            },
        });

        const response = await run(
            withdraws
                ? retroRequest<PokerVoteResponse>(
                      PokerVotesController.destroy(route),
                  )
                : retroRequest<PokerVoteResponse>(
                      PokerVotesController.update(route),
                      { value: card },
                  ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        apply({ type: 'vote.mine', response });

        if (response.revealed) {
            await refetch();
        }
    };

    return (
        <div
            role="group"
            aria-label={t('Your cards')}
            className="sticky bottom-0 -mx-4 mt-auto flex gap-2 overflow-x-auto border-t bg-background/95 px-4 pt-5 pb-3 backdrop-blur"
        >
            {game.cards.map((card) => (
                <PokerCard
                    key={card}
                    value={card}
                    face="up"
                    selected={round?.myVote === card}
                    label={t('Play :card', { card })}
                    disabled={isClosed || busy}
                    onClick={() => void play(card)}
                />
            ))}
        </div>
    );
}
