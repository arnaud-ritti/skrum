import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import GameRoundCluesController from '@/actions/App/Http/Controllers/Games/GameRoundCluesController';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { ClueSlots, isClueEmoji } from '@/lib/games/clue';
import type { GameClueResponse, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

const SaveDelayMs = 300;

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
        <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center gap-2">
                {Array.from({ length: ClueSlots }, (_, index) => {
                    const emoji = clue[index];

                    if (emoji !== undefined) {
                        return (
                            <button
                                key={index}
                                type="button"
                                aria-label={t('Remove :emoji', { emoji })}
                                className="group relative flex size-14 items-center justify-center rounded-lg border text-3xl hover:bg-muted"
                                onClick={() =>
                                    save(
                                        clue.filter(
                                            (_, position) => position !== index,
                                        ),
                                    )
                                }
                            >
                                {emoji}
                                <X className="absolute -top-1.5 -right-1.5 size-4 rounded-full border bg-background opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                            </button>
                        );
                    }

                    if (index !== clue.length) {
                        return (
                            <span
                                key={index}
                                className="size-14 rounded-lg border border-dashed"
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
                            <Button
                                type="button"
                                variant="outline"
                                className="size-14"
                            >
                                <Plus className="size-5" />
                            </Button>
                        </EmojiPicker>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'Describe the word with up to five emoji, without letters or digits.',
                )}
            </p>
        </div>
    );
}
