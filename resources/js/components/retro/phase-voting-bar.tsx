import { EyeOff } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import CardVotesController from '@/actions/App/Http/Controllers/Retros/CardVotesController';
import { VoteBudget } from '@/components/skrum/vote-dots';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import {
    isObserving,
    votingProgress,
    type CardVoting,
} from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

type Tally = {
    cardId: string;
    myVotes: number;
    remainingVotes: number;
    votesCast: number;
    votesVersion: number;
    total: number | null;
    /** Who has finished voting, when this vote took the voter's back. */
    finishedIds: string[] | null;
};

/**
 * Adds or takes back one vote of the viewer on a card (the lead card, for a
 * group). The count moves at once, then takes the answer of the server. A
 * press made while the last one is on its way is dropped.
 */
export function useCardVote(card: BoardCard): (delta: 1 | -1) => void {
    const ctx = useBoard();
    const inFlight = useRef(false);

    return (delta) => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;

        const route = { retro: ctx.board.retro.id, card: card.id };

        ctx.dispatch({
            type: 'votes.tally',
            cardId: card.id,
            myVotes: card.myVotes + delta,
            remainingVotes: ctx.board.viewer.remainingVotes - delta,
        });

        void ctx
            .run(
                retroRequest<Tally>(
                    delta === 1
                        ? CardVotesController.store(route)
                        : CardVotesController.destroy(route),
                ),
            )
            .finally(() => {
                inFlight.current = false;
            })
            .then((tally) => {
                if (!tally) {
                    return;
                }

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

                if (tally.finishedIds !== null) {
                    ctx.apply({
                        type: 'voting.finished',
                        finishedIds: tally.finishedIds,
                    });
                }
            });
    };
}

/** Why "Add a vote" is disabled, as the card says it next to the button. */
export function useVoteBlockedLabel(): (
    voting: Pick<CardVoting, 'blocked' | 'maxPerCard'>,
) => string | undefined {
    const { t } = useTrans();

    return ({ blocked, maxPerCard }) => {
        if (blocked === 'locked') {
            return t('Board closed for editing');
        }

        if (blocked === 'spent') {
            return t('You have used all your votes');
        }

        if (blocked === 'cap') {
            return t('Max :count votes per card', { count: maxPerCard ?? 0 });
        }

        return undefined;
    };
}

type PhaseVotingBarProps = {
    /** Place of the per-card cap, said after "of n" in the budget (RT-3). */
    cap?: ReactNode;
    /** Place of "x/y have finished", at the end of the bar (RT-4). */
    finished?: ReactNode;
    /** Place of the participant's "I have finished voting" (RT-4). */
    done?: ReactNode;
    /**
     * On a phone the bar is cut in two: the budget stays stuck above the
     * column tabs, the rest scrolls with the cards.
     */
    part?: 'all' | 'budget' | 'progress';
};

/**
 * The line above the columns in Voting: the votes I have left, whether the
 * totals are hidden, and how far the room is.
 */
export function PhaseVotingBar({
    cap,
    finished,
    done,
    part = 'all',
}: PhaseVotingBarProps) {
    const { board } = useBoard();
    const { t } = useTrans();
    const { cast, total } = votingProgress(board);
    const budget = board.retro.votesPerParticipant;
    const remaining = board.viewer.remainingVotes;
    const showsBudget = part !== 'progress' && !isObserving(board);
    const showsProgress = part !== 'budget';

    return (
        <div
            data-slot="retro-voting-bar"
            data-part={part}
            className={cn(
                'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6',
                part !== 'budget' && 'pt-3',
            )}
        >
            {showsBudget && (
                <>
                    <VoteBudget
                        total={budget}
                        remaining={remaining}
                        detail={
                            <>
                                {t('of :total', { total: budget })}
                                {cap}
                            </>
                        }
                    />
                    <span className="sr-only">
                        {t('Votes left: :count', { count: remaining })}
                    </span>
                </>
            )}
            {showsProgress && board.retro.hideVoteCounts && (
                <Badge
                    variant="info"
                    shape="pill"
                    data-slot="retro-voting-hidden"
                    className="max-w-full"
                >
                    <EyeOff aria-hidden />
                    <span className="truncate">
                        {t('Votes hidden until the reveal')}
                    </span>
                </Badge>
            )}
            {showsProgress && (
                <>
                    <span className="grow" />
                    <div
                        data-slot="retro-voting-progress"
                        className="w-72 max-w-full min-w-0"
                    >
                        <Progress
                            value={cast}
                            max={total}
                            aria-label={t('Votes cast')}
                            valueLabel={t(
                                total === 1
                                    ? ':cast of :total vote cast'
                                    : cast === 1
                                      ? '1 of :total votes cast'
                                      : ':cast of :total votes cast',
                                { cast, total },
                            )}
                        />
                    </div>
                </>
            )}
            {showsProgress && finished !== undefined && finished !== null && (
                <div data-slot="retro-voting-finished" className="min-w-0">
                    {finished}
                </div>
            )}
            {showsProgress && done !== undefined && done !== null && (
                <div data-slot="retro-voting-done" className="min-w-0">
                    {done}
                </div>
            )}
        </div>
    );
}
