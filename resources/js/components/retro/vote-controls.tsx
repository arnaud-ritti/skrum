import { Minus, Plus } from 'lucide-react';
import CardVotesController from '@/actions/App/Http/Controllers/Retros/CardVotesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard } from '@/lib/retro/types';
import type { BoardContextValue } from './board';

type Tally = { cardId: string; myVotes: number; remainingVotes: number };

export function VoteControls({
    card,
    ctx,
}: {
    card: BoardCard;
    ctx: BoardContextValue;
}) {
    const { t } = useTrans();
    const route = { retro: ctx.board.retro.id, card: card.id };

    const vote = async (delta: 1 | -1) => {
        ctx.dispatch({
            type: 'votes.tally',
            cardId: card.id,
            myVotes: card.myVotes + delta,
            remainingVotes: ctx.board.viewer.remainingVotes - delta,
        });

        const tally = await ctx.run(
            retroRequest<Tally>(
                delta === 1
                    ? CardVotesController.store(route)
                    : CardVotesController.destroy(route),
            ),
        );

        if (tally) {
            ctx.dispatch({ type: 'votes.tally', ...tally });
            ctx.dispatch({ type: 'votes.adjust', delta });
        }
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t('Remove a vote')}
                disabled={card.myVotes === 0}
                onClick={() => void vote(-1)}
            >
                <Minus className="size-3.5" />
            </Button>
            <span
                className="min-w-4 text-center font-medium"
                aria-hidden="true"
            >
                {card.myVotes}
            </span>
            <span className="sr-only">
                {t(
                    card.myVotes === 1
                        ? 'Your vote: :count'
                        : 'Your votes: :count',
                    {
                        count: card.myVotes,
                    },
                )}
            </span>
            <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t('Add a vote')}
                disabled={ctx.board.viewer.remainingVotes === 0}
                onClick={() => void vote(1)}
            >
                <Plus className="size-3.5" />
            </Button>
        </div>
    );
}
