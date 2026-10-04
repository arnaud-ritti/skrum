import { Flag, Heart } from 'lucide-react';
import { useState } from 'react';
import GameClosuresController from '@/actions/App/Http/Controllers/Games/GameClosuresController';
import GameVotesController from '@/actions/App/Http/Controllers/Games/GameVotesController';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { canVoteFor, myGifAnswer, revealedAnswers } from '@/lib/games/gif';
import type { GameRound, GameRoundEnded } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useHasLeftColumn } from './game-layout';
import { GifTile } from './gif-tile';
import { GifVoteBudget } from './gif-vote-budget';
import { useRoom } from './room-context';

type HeartVoteProps = {
    /** Names the GIF too, so each heart of the list says which one it is. */
    label: string;
    pressed: boolean;
    disabledReason: string | null;
    busy: boolean;
    onToggle: () => void;
};

/** The heart of a GIF when the round gives several votes. */
function HeartVote({
    label,
    pressed,
    disabledReason,
    busy,
    onToggle,
}: HeartVoteProps) {
    const isBlocked = disabledReason !== null;
    const button = (
        <button
            type="button"
            data-slot="gif-vote-button"
            aria-label={label}
            aria-pressed={pressed}
            disabled={isBlocked || busy}
            onClick={onToggle}
            className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none max-md:size-11',
                pressed
                    ? 'border-transparent bg-skrum-primary-soft text-skrum-primary-text'
                    : 'border-input bg-card text-foreground hover:bg-accent',
                isBlocked && 'cursor-not-allowed opacity-60',
            )}
        >
            <Heart
                aria-hidden
                className={cn('size-4', pressed && 'fill-current')}
            />
        </button>
    );

    if (!isBlocked) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    data-slot="gif-vote-blocked"
                    role="group"
                    tabIndex={0}
                    aria-label={disabledReason}
                    className="inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {button}
                </span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
    );
}

/** Counts stay hidden until the host finishes the round (spec §4.2). */
export function GifVotingStage({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const hasLeftColumn = useHasLeftColumn();
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const answers = revealedAnswers(round);
    const voters = round.voters ?? [];
    const myVotes = round.myVotes ?? [];
    const hasBudget = (round.votesAllowed ?? 1) > 1;
    const myAnswerId = myGifAnswer(round)?.id ?? null;
    const byId = new Map(players.map((player) => [player.id, player]));
    const total = Math.max(ctx.online.length, voters.length);
    const target = { room: room.id, round: round.id };

    const patchVotes = (votes: string[]) => {
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { myVotes: votes, myVote: votes[0] ?? null },
        });
    };

    /** A one-vote round replaces its vote, as before the budget. */
    const favourite = async (answerId: string) => {
        const retracting = round.myVote === answerId;

        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest(
                    retracting
                        ? GameVotesController.destroy(target)
                        : GameVotesController.update(target),
                    retracting ? undefined : { answer_id: answerId },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (result === undefined) {
            return;
        }

        ctx.dispatch({
            type: 'vote.changed',
            roundId: round.id,
            playerId: me.playerId,
            voted: !retracting,
        });
        patchVotes(retracting ? [] : [answerId]);
    };

    /** With a budget, each heart adds or withdraws its own vote, shown at once. */
    const toggleHeart = async (answerId: string) => {
        const withdrawing = myVotes.includes(answerId);
        const before = myVotes;
        const after = withdrawing
            ? myVotes.filter((vote) => vote !== answerId)
            : [...myVotes, answerId];

        patchVotes(after);
        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest(
                    withdrawing
                        ? GameVotesController.destroy(target)
                        : GameVotesController.update(target),
                    { answer_id: answerId },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (result === undefined) {
            patchVotes(before);

            return;
        }

        ctx.dispatch({
            type: 'vote.changed',
            roundId: round.id,
            playerId: me.playerId,
            voted: after.length > 0,
        });
    };

    const finish = async () => {
        setBusy(true);

        let response: { ended: GameRoundEnded } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ ended: GameRoundEnded }>(
                    GameClosuresController.store(target),
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        ctx.dispatch({ type: 'round.ended', ended: response.ended });
        void ctx.refetch();
    };

    return (
        <section
            data-slot="gif-voting-stage"
            className="flex w-full flex-col gap-4"
        >
            {!hasLeftColumn && <GifVoteBudget round={round} />}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm font-medium">
                    {t(':count of :total voted', {
                        count: voters.length,
                        total,
                    })}
                </p>
                {room.isHost && (
                    <Button disabled={busy} onClick={() => void finish()}>
                        <Flag aria-hidden />
                        {t('Finish round')}
                    </Button>
                )}
            </div>
            {answers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                    {t('No GIFs yet.')}
                </p>
            ) : (
                <ul
                    data-slot="gif-gallery"
                    className="grid w-full grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] items-start gap-4"
                >
                    {answers.map((answer, index) => {
                        const number = index + 1;
                        const isMine = answer.id === myAnswerId;
                        const isChosen = hasBudget
                            ? myVotes.includes(answer.id)
                            : answer.id === round.myVote;
                        const player =
                            answer.playerId === null
                                ? null
                                : (byId.get(answer.playerId) ?? null);
                        const author =
                            answer.playerId === null
                                ? null
                                : (player?.name ?? t('Someone'));
                        const hiddenAuthor = round.authorsHidden
                            ? t('Hidden until the votes close')
                            : t('Anonymous GIF');
                        const caption = isMine
                            ? t('Your GIF')
                            : author === null
                              ? hiddenAuthor
                              : t('by :name', { name: author });

                        return (
                            <li key={answer.id} className="min-w-0">
                                <GifTile
                                    gif={answer.gif}
                                    caption={caption}
                                    description={answer.caption}
                                    author={player}
                                    highlight={isChosen}
                                >
                                    {!isMine && hasBudget && (
                                        <div className="flex justify-end">
                                            <HeartVote
                                                label={t(
                                                    'Vote for GIF :number',
                                                    { number },
                                                )}
                                                pressed={isChosen}
                                                busy={busy}
                                                disabledReason={
                                                    canVoteFor(
                                                        round,
                                                        answer.id,
                                                        myAnswerId,
                                                    )
                                                        ? null
                                                        : t(
                                                              'You have used all your votes.',
                                                          )
                                                }
                                                onToggle={() =>
                                                    void toggleHeart(answer.id)
                                                }
                                            />
                                        </div>
                                    )}
                                    {!isMine && !hasBudget && (
                                        <div className="flex justify-end">
                                            <Toggle
                                                variant="outline"
                                                size="sm"
                                                pressed={isChosen}
                                                aria-label={
                                                    isChosen
                                                        ? t(
                                                              'Your favourite: GIF :number',
                                                              { number },
                                                          )
                                                        : t(
                                                              'Favourite: GIF :number',
                                                              { number },
                                                          )
                                                }
                                                disabled={busy}
                                                className="max-w-full rounded-full"
                                                onPressedChange={() =>
                                                    void favourite(answer.id)
                                                }
                                            >
                                                <Heart
                                                    aria-hidden
                                                    className={cn(
                                                        isChosen &&
                                                            'fill-current',
                                                    )}
                                                />
                                                <span className="truncate">
                                                    {isChosen
                                                        ? t('Your favourite')
                                                        : t('Favourite')}
                                                </span>
                                            </Toggle>
                                        </div>
                                    )}
                                </GifTile>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
