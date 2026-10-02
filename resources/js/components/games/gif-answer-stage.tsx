import { Check, Eye, EyeOff, ImagePlay, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import GameAnswersController from '@/actions/App/Http/Controllers/Games/GameAnswersController';
import GameGifsController from '@/actions/App/Http/Controllers/Games/GameGifsController';
import GameRevealsController from '@/actions/App/Http/Controllers/Games/GameRevealsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { pendingAnswers } from '@/lib/games/gif';
import type {
    GameGifSearchResult,
    GameMyGifAnswer,
    GameRound,
} from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

type Props = {
    round: GameRound;
    /** Place left under the chosen GIF for its caption (GM-3). */
    caption?: ReactNode;
};

/** Other players' GIFs are never known before the reveal: only placeholders. */
export function GifAnswerStage({ round, caption }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const { room, me, players } = ctx.snapshot;
    const others = pendingAnswers(round).filter(
        (answer) => answer.playerId !== me.playerId,
    );
    const byId = new Map(players.map((player) => [player.id, player]));
    const roomId = room.id;
    const target = { room: roomId, round: round.id };

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                GameGifsController.index(roomId, { query: { q: query } }),
            ),
        [roomId],
    );

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
        <section
            data-slot="gif-answer-stage"
            aria-labelledby="gif-pick-title"
            className="flex w-full max-w-160 flex-col gap-4"
        >
            <Card className="gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 id="gif-pick-title" className="text-base font-title">
                        {t('Your pick')}
                    </h3>
                    {round.myAnswer && (
                        <Badge variant="success" shape="pill" icon={Check}>
                            {t('Sent')}
                        </Badge>
                    )}
                </div>
                {round.myAnswer ? (
                    <div className="flex min-w-0 flex-col gap-3 @md/card:flex-row @md/card:items-start">
                        <GifTile
                            gif={round.myAnswer.gif}
                            caption={t('Your GIF')}
                            className="w-full shrink-0 @md/card:w-64"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <EyeOff
                                    aria-hidden
                                    className="size-4 shrink-0"
                                />
                                {t('Your GIF stays hidden until the reveal.')}
                            </p>
                            {caption}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => setPicking(true)}
                                >
                                    <RefreshCw aria-hidden />
                                    {t('Change GIF')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => void remove()}
                                >
                                    <Trash2 aria-hidden />
                                    {t('Remove GIF')}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input bg-muted/60 px-4 py-8 text-center">
                        <ImagePlay
                            aria-hidden
                            className="size-6 text-muted-foreground"
                        />
                        <Button
                            disabled={busy}
                            onClick={() => setPicking(true)}
                        >
                            {t('Choose a GIF')}
                        </Button>
                    </div>
                )}
            </Card>
            {others.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-sm font-medium">
                        {t('Already sent · :count', { count: others.length })}
                    </h3>
                    <ul
                        aria-label={t('Answers')}
                        className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2"
                    >
                        {others.map((answer) => {
                            const player = byId.get(answer.playerId);
                            const name = player?.name ?? t('Someone');

                            return (
                                <li
                                    key={answer.playerId}
                                    data-slot="gif-hidden"
                                    className="flex min-h-18 min-w-0 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-muted/60 p-2 text-muted-foreground"
                                >
                                    <EyeOff aria-hidden className="size-5" />
                                    <span className="flex max-w-full min-w-0 items-center gap-1.5 text-xs font-medium">
                                        {player &&
                                            player.avatarUrl !== null && (
                                                <PersonAvatar
                                                    name={name}
                                                    src={player.avatarUrl}
                                                    kind={
                                                        player.isGuest
                                                            ? 'guest'
                                                            : 'member'
                                                    }
                                                    size="xs"
                                                    decorative
                                                />
                                            )}
                                        <span className="min-w-0 truncate">
                                            {t(':name answered', { name })}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {others.length === 0 && !round.myAnswer && (
                <p className="text-center text-sm text-muted-foreground">
                    {t('No GIFs yet.')}
                </p>
            )}
            {room.isHost && (
                <div className="flex justify-center">
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void reveal()}
                    >
                        <Eye aria-hidden />
                        {t('Reveal the GIFs')}
                    </Button>
                </div>
            )}
            <GifSearchDialog
                open={picking}
                onOpenChange={setPicking}
                onPick={(gif) => void choose(gif)}
                search={search}
                provider={round.gifProvider ?? null}
                selectedId={round.myAnswer?.gif.id}
            />
        </section>
    );
}
