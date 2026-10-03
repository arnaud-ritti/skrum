import { EyeOff, ImagePlay, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import GameAnswersController from '@/actions/App/Http/Controllers/Games/GameAnswersController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { myGifAnswer, pendingAnswers } from '@/lib/games/gif';
import type { GameMyGifAnswer, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { GifCaptionField } from './gif-caption-field';
import { useGifDraft } from './gif-draft';
import { GifTile } from './gif-tile';
import { useRoom } from './room-context';

type Props = {
    round: GameRound;
    /** `h2` in a side column, `h3` under the title of the stage. */
    heading?: 'h2' | 'h3';
    className?: string;
};

/**
 * What the player picked on the stage: a draft until "Send my GIF", then the
 * sent GIF, each with its caption. Other players' GIFs are never known before
 * the reveal: only placeholders.
 */
export function GifYourPick({
    round,
    heading: Heading = 'h2',
    className,
}: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const {
        draft,
        clear,
        focusPicker,
        caption: typedCaption,
        setCaption,
        clearCaption,
    } = useGifDraft(round.id);
    const [busy, setBusy] = useState(false);
    const changeRef = useRef<HTMLButtonElement>(null);
    const { room, me, players } = ctx.snapshot;
    const target = { room: room.id, round: round.id };
    const sent = myGifAnswer(round);
    const pending = draft !== null && draft.id !== sent?.gif.id ? draft : null;
    const shown = pending ?? sent?.gif ?? null;
    const sentCaption = sent?.caption ?? '';
    const caption = typedCaption ?? sentCaption;
    const hasCaptionDraft =
        sent !== null &&
        typedCaption !== null &&
        caption.trim() !== sentCaption;
    const isDraft = pending !== null || hasCaptionDraft;
    const others = pendingAnswers(round).filter(
        (answer) => answer.playerId !== me.playerId,
    );
    const byId = new Map(players.map((player) => [player.id, player]));

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

    const send = async (gifId: string) => {
        setBusy(true);

        let response: { myAnswer: GameMyGifAnswer } | undefined;

        try {
            response = await ctx.run(
                retroRequest<{ myAnswer: GameMyGifAnswer }>(
                    GameAnswersController.update(target),
                    { gif_id: gifId, caption: caption.trim() || null },
                ),
            );
        } finally {
            setBusy(false);
        }

        if (!response) {
            return;
        }

        markAnswered(response.myAnswer);
        clear();
        clearCaption();
        requestAnimationFrame(() => changeRef.current?.focus());
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

        if (result === undefined) {
            return;
        }

        markAnswered(null);
        clear();
        clearCaption();
        focusPicker();
    };

    return (
        <section
            data-slot="gif-your-pick"
            data-state={isDraft ? 'draft' : sent ? 'sent' : 'empty'}
            aria-labelledby="gif-pick-title"
            className={cn('flex min-w-0 flex-col gap-4', className)}
        >
            <div className="flex items-center justify-between gap-2">
                <Heading id="gif-pick-title" className="text-base font-title">
                    {t('Your pick')}
                </Heading>
                <span role="status" className="flex shrink-0">
                    {isDraft && (
                        <Badge variant="warning" shape="pill">
                            {t('Draft')}
                        </Badge>
                    )}
                    {!isDraft && sent && (
                        <Badge variant="success" shape="pill">
                            {t('Sent')}
                        </Badge>
                    )}
                </span>
            </div>
            {shown ? (
                <>
                    <GifTile
                        gif={shown}
                        caption={t('Your GIF')}
                        description={pending === null ? sent?.caption : null}
                    />
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <EyeOff
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0"
                        />
                        {t('Your GIF stays hidden until the reveal.')}
                    </p>
                    <GifCaptionField
                        value={caption}
                        disabled={busy}
                        onChange={setCaption}
                    />
                </>
            ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    <ImagePlay aria-hidden className="size-6" />
                    {t('Choose a GIF')}
                </div>
            )}
            {pending && (
                <div className="flex min-w-0 gap-2">
                    <Button
                        className="min-w-0 flex-1"
                        disabled={busy}
                        onClick={() => void send(pending.id)}
                    >
                        <Send aria-hidden />
                        <span className="truncate">{t('Send my GIF')}</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="min-w-0"
                        disabled={busy}
                        onClick={() => {
                            clear();
                            focusPicker();
                        }}
                    >
                        <RefreshCw aria-hidden />
                        <span className="truncate">{t('Change')}</span>
                    </Button>
                </div>
            )}
            {!pending && sent && (
                <div className="flex min-w-0 flex-wrap gap-2">
                    {hasCaptionDraft && (
                        <Button
                            className="min-w-0"
                            disabled={busy}
                            onClick={() => void send(sent.gif.id)}
                        >
                            <Save aria-hidden />
                            <span className="truncate">
                                {t('Save caption')}
                            </span>
                        </Button>
                    )}
                    <Button
                        ref={changeRef}
                        variant="outline"
                        className="min-w-0"
                        disabled={busy}
                        onClick={focusPicker}
                    >
                        <RefreshCw aria-hidden />
                        <span className="truncate">{t('Change GIF')}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        className="min-w-0"
                        disabled={busy}
                        onClick={() => void remove()}
                    >
                        <Trash2 aria-hidden />
                        <span className="truncate">{t('Remove GIF')}</span>
                    </Button>
                </div>
            )}
            {others.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2 border-t pt-4">
                    <h3 className="text-sm font-medium">
                        {t('Already sent · :count', { count: others.length })}
                    </h3>
                    <ul
                        aria-label={t('Answers')}
                        className="grid grid-cols-3 gap-2"
                    >
                        {others.map((answer) => {
                            const player = byId.get(answer.playerId);
                            const name = player?.name ?? t('Someone');
                            const hasAvatar =
                                player !== undefined &&
                                player.avatarUrl !== null;

                            return (
                                <li
                                    key={answer.playerId}
                                    data-slot="gif-hidden"
                                    className="relative grid h-18 min-w-0 place-items-center rounded-md border border-dashed border-input bg-muted/60 text-muted-foreground"
                                >
                                    <EyeOff aria-hidden className="size-5" />
                                    {hasAvatar && (
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
                                            title={name}
                                            className="absolute bottom-1.5 left-1.5"
                                        />
                                    )}
                                    <span
                                        className={
                                            hasAvatar
                                                ? 'sr-only'
                                                : 'absolute inset-x-1.5 bottom-1 truncate text-center text-xs font-medium'
                                        }
                                    >
                                        {t(':name answered', { name })}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {others.length === 0 && !sent && (
                <p className="text-sm text-muted-foreground">
                    {t('No GIFs yet.')}
                </p>
            )}
        </section>
    );
}
