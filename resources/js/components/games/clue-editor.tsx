import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import GameRoundCluesController from '@/actions/App/Http/Controllers/Games/GameRoundCluesController';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { useTrans } from '@/hooks/use-trans';
import { ClueSlots, isClueEmoji } from '@/lib/games/clue';
import type { GameClueResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { clueGapClasses, clueTileClasses } from './clue-row';
import { useRoom } from './room-context';

const SaveDelayMs = 300;

const slotClass = cn(
    'relative flex shrink-0 items-center justify-center border leading-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    clueTileClasses.lg,
);

/**
 * The round's clue is the source of truth: edits patch it at once and the
 * whole row is saved after a short pause, so the last edit wins.
 */
export function ClueEditor({ round }: { round: GameRound }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const timer = useRef<number | null>(null);
    const clue = round.clue ?? [];
    const roomId = ctx.snapshot.room.id;

    useEffect(
        () => () => {
            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    const save = (next: string[]) => {
        ctx.dispatch({
            type: 'round.patched',
            roundId: round.id,
            patch: { clue: next },
        });

        if (timer.current !== null) {
            window.clearTimeout(timer.current);
        }

        timer.current = window.setTimeout(() => {
            timer.current = null;

            void ctx.run(
                retroRequest<GameClueResponse>(
                    GameRoundCluesController.update({
                        room: roomId,
                        round: round.id,
                    }),
                    { clue: next },
                ),
            );
        }, SaveDelayMs);
    };

    const add = (emoji: string) => {
        if (!isClueEmoji(emoji)) {
            toast.error(t('Use emoji only, without letters or digits.'));

            return;
        }

        save([...clue, emoji].slice(0, ClueSlots));
    };

    return (
        <div
            data-slot="clue-editor"
            className="flex w-full flex-col items-center gap-3"
        >
            <div className={cn('flex justify-center', clueGapClasses.lg)}>
                {Array.from({ length: ClueSlots }, (_, index) => {
                    const emoji = clue[index];

                    if (emoji !== undefined) {
                        return (
                            <button
                                key={index}
                                type="button"
                                aria-label={t('Remove :emoji', { emoji })}
                                className={cn(
                                    slotClass,
                                    'group bg-card shadow-card hover:bg-muted',
                                )}
                                onClick={() =>
                                    save(
                                        clue.filter(
                                            (_, position) => position !== index,
                                        ),
                                    )
                                }
                            >
                                {emoji}
                                <X
                                    aria-hidden
                                    className="absolute -top-1.5 -right-1.5 size-4 rounded-full border bg-background text-foreground"
                                />
                            </button>
                        );
                    }

                    if (index !== clue.length) {
                        return (
                            <span
                                key={index}
                                className={cn(
                                    slotClass,
                                    'border-dashed border-input',
                                )}
                            />
                        );
                    }

                    return (
                        <EmojiPicker
                            key={index}
                            label={t('Add an emoji')}
                            emojiData={ctx.snapshot.emojiData}
                            onPick={add}
                        >
                            <button
                                type="button"
                                className={cn(
                                    slotClass,
                                    'border-dashed border-(--col-text) text-(--col-text) hover:bg-card/60',
                                )}
                            >
                                <Plus aria-hidden className="size-5" />
                            </button>
                        </EmojiPicker>
                    );
                })}
            </div>
            <p className="text-center text-xs text-muted-foreground">
                {t(
                    'Describe the word with up to five emoji, without letters or digits.',
                )}
            </p>
        </div>
    );
}
