import { Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import CardVotesController from '@/actions/App/Http/Controllers/Retros/CardVotesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard } from '@/lib/retro/types';
import { useBoard } from './board-context';

type Tally = {
    cardId: string;
    myVotes: number;
    remainingVotes: number;
    votesCast: number;
    votesVersion: number;
    total: number | null;
};

export function VoteControls({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const route = { retro: ctx.board.retro.id, card: card.id };

    const vote = async (delta: 1 | -1) => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;
        setBusy(true);

        ctx.dispatch({
            type: 'votes.tally',
            cardId: card.id,
            myVotes: card.myVotes + delta,
            remainingVotes: ctx.board.viewer.remainingVotes - delta,
        });

        const tally = await ctx
            .run(
                retroRequest<Tally>(
                    delta === 1
                        ? CardVotesController.store(route)
                        : CardVotesController.destroy(route),
                ),
            )
            .finally(() => {
                inFlight.current = false;
                setBusy(false);
            });

        if (tally) {
            ctx.apply({
                type: 'votes.tally',
                cardId: tally.cardId,
                myVotes: tally.myVotes,
                remainingVotes: tally.remainingVotes,
                votesVersion: tally.votesVersion,
            });
            ctx.apply({
                type: 'votes.cast',
                votesCast: tally.votesCast,
                votesVersion: tally.votesVersion,
                cardId: tally.cardId,
                total: tally.total ?? undefined,
            });
        }
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t('Remove a vote')}
                disabled={busy || !ctx.isEditable || card.myVotes === 0}
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
                disabled={
                    busy ||
                    !ctx.isEditable ||
                    ctx.board.viewer.remainingVotes === 0
                }
                onClick={() => void vote(1)}
            >
                <Plus className="size-3.5" />
            </Button>
        </div>
    );
}
