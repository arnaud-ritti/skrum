import { Check, MessageCircleQuestion, SkipForward } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import GameTurnsController from '@/actions/App/Http/Controllers/Games/GameTurnsController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type {
    GameRound,
    GameRoundEnded,
    GameTurnChanged,
} from '@/lib/games/types';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import {
    dockedPanelClass,
    useHasRightColumn,
    useStageFooter,
} from './game-layout';
import { QuestionBanner } from './question-banner';
import { useRoom } from './room-context';
import { TurnOrder } from './turn-order';

type TurnResponse = {
    turn: GameTurnChanged;
    ended: GameRoundEnded | null;
};

const ConflictStatus = 409;

/**
 * A round of Quick question (spec §6.11, §9.9): one question answered aloud,
 * one speaker after the other. The speaker ends their turn with "Done", the
 * host moves on with "Next"; the turn timer stands in the stage's header.
 */
export function QuickQuestionBoard({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const hasRightColumn = useHasRightColumn();
    const footer = useStageFooter();
    const { room, me, players } = ctx.snapshot;
    const speakerId = round.turnPlayerId;
    const speaker = players.find((player) => player.id === speakerId) ?? null;
    const speakerName = speaker?.name ?? t('Someone');
    const isSpeaker = speakerId !== null && speakerId === me.playerId;
    const canMoveOn = speakerId !== null && (isSpeaker || room.isHost);

    const endTurn = async () => {
        if (speakerId === null) {
            return;
        }

        setBusy(true);

        let response: TurnResponse | null | undefined;

        try {
            response = await ctx.run(
                retroRequest<TurnResponse>(
                    GameTurnsController.store({
                        room: room.id,
                        round: round.id,
                    }),
                    { expected_player_id: speakerId },
                ).catch((error: unknown) => {
                    /** Someone else moved the turn on first: catch up without a toast. */
                    if (
                        error instanceof RetroRequestError &&
                        error.status === ConflictStatus
                    ) {
                        void ctx.refetch();

                        return null;
                    }

                    throw error;
                }),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        if (response.ended) {
            ctx.dispatch({ type: 'round.ended', ended: response.ended });
            void ctx.refetch();

            return;
        }

        ctx.dispatch({ type: 'turn.changed', turn: response.turn });
    };

    const action = canMoveOn && (
        <Button
            size="lg"
            variant={isSpeaker ? 'default' : 'outline'}
            disabled={busy}
            className="w-full sm:w-auto"
            onClick={() => void endTurn()}
        >
            {isSpeaker ? <Check aria-hidden /> : <SkipForward aria-hidden />}
            {isSpeaker ? t('Done') : t('Next')}
        </Button>
    );

    return (
        <div
            data-slot="quick-question-board"
            className="flex w-full flex-col items-center gap-5"
        >
            <QuestionBanner
                round={round}
                icon={MessageCircleQuestion}
                hint={t('Answer aloud, one after the other.')}
            />
            <Card
                data-slot="quick-question-speaker"
                className="w-full max-w-160 items-center gap-4 px-6 py-8 text-center"
            >
                <span className="flex rounded-full ring-2 ring-primary ring-offset-2 ring-offset-card">
                    <PersonAvatar
                        name={speakerName}
                        src={speaker?.avatarUrl}
                        kind={speaker?.isGuest ? 'guest' : 'member'}
                        size="xl"
                        className="size-16"
                        decorative
                    />
                </span>
                <p
                    aria-live="polite"
                    className="max-w-full font-display text-xl font-title break-words"
                >
                    {isSpeaker
                        ? t('Your turn to speak')
                        : t(':name is speaking', { name: speakerName })}
                </p>
                {footer === null && action}
            </Card>
            {!hasRightColumn && (
                <div className="w-full max-w-160">
                    <TurnOrder />
                </div>
            )}
            {footer !== null &&
                action &&
                createPortal(
                    <div
                        data-slot="quick-question-dock"
                        className={cn(
                            'flex flex-col items-stretch bg-muted px-4',
                            dockedPanelClass,
                        )}
                    >
                        {action}
                    </div>,
                    footer,
                )}
        </div>
    );
}
