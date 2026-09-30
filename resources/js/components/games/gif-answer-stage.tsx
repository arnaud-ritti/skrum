import { Eye, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import GameAnswersController from '@/actions/App/Http/Controllers/Games/GameAnswersController';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import type { PickedGif } from '@/components/gifs/gif-search-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import type { GameMyGifAnswer, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { GameGifPicker } from './game-gif-picker';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

/** Other players' GIFs are never known before the reveal: only placeholders. */
export function GifAnswerStage({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const others = pendingAnswers(round).filter(
        (answer) => answer.playerId !== me.playerId,
    );
    const names = new Map(players.map((player) => [player.id, player.name]));
    const target = { room: room.id, round: round.id };

    const markAnswered = (myAnswer: GameMyGifAnswer | null) => {
        ctx.dispatch({
            type: 'answer.changed',
            roundId: round.id,
            playerId: me.playerId,
            answered: myAnswer !== null,
        });
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { myAnswer },
        });
    };

    const choose = async (gif: PickedGif) => {
        setBusy(true);

        let response: { myAnswer: GameMyGifAnswer } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ myAnswer: GameMyGifAnswer }>(
                    GameAnswersController.update(target),
                    { gif_id: gif.id },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (response) {
            markAnswered(response.myAnswer);
        }
    };

    const remove = async () => {
        setBusy(true);

        let result: null | undefined;

        try {
            result = await ctx.run(
                retroRequest(GameAnswersController.destroy(target)),
            );
        } finally {
            setBusy(false);
        }

        if (result !== undefined) {
            markAnswered(null);
        }
    };

    const reveal = async () => {
        setBusy(true);

        let revealed: GameRound | undefined;

        try {
            revealed = await ctx.run(
                retroRequest<GameRound>(GameRevealsController.store(target)),
            );
        } finally {
            setBusy(false);
        }

        if (revealed) {
            ctx.dispatch({
                type: 'round.patched',
                roundId: round.id,
                patch: revealed,
            });
        }
    };

    return (
        <section className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
                {t('Pick a GIF that answers the question.')}
            </p>
            {round.myAnswer && (
                <div className="w-48">
                    <GifTile gif={round.myAnswer.gif} caption={t('Your GIF')} />
                </div>
            )}
            <div className="flex gap-2">
                <Button disabled={busy} onClick={() => setPicking(true)}>
                    {round.myAnswer ? t('Change GIF') : t('Choose a GIF')}
                </Button>
                {round.myAnswer && (
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void remove()}
                    >
                        {t('Remove GIF')}
                    </Button>
                )}
            </div>
            {others.length > 0 ? (
                <ul
                    aria-label={t('Answers')}
                    className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                >
                    {others.map((answer) => (
                        <li
                            key={answer.playerId}
                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-center text-sm text-muted-foreground"
                        >
                            <ImageIcon className="size-6" aria-hidden />
                            {t(':name answered', {
                                name:
                                    names.get(answer.playerId) ?? t('Someone'),
                            })}
                        </li>
                    ))}
                </ul>
            ) : (
                !round.myAnswer && (
                    <p className="text-sm text-muted-foreground">
                        {t('No GIFs yet.')}
                    </p>
                )
            )}
            {room.isHost && (
                <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void reveal()}
                >
                    <Eye className="size-4" />
                    {t('Reveal the GIFs')}
                </Button>
            )}
            <GameGifPicker
                open={picking}
                onOpenChange={setPicking}
                onPick={(gif) => void choose(gif)}
                provider={round.gifProvider ?? null}
            />
        </section>
    );
}
