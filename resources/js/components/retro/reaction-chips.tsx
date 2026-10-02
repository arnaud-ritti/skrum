import { SmilePlus } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { EmojiDataLocation } from '@/lib/games/types';
import type { ReactionSummary } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { dragIsolation } from './dnd';
import { EmojiPicker } from './emoji-picker';

type Props = {
    reactions: ReactionSummary[];
    canReact: boolean;
    onToggle: (emoji: string) => void;
};

/**
 * "Add a reaction": the dashed chip that opens the quick list and, from it,
 * the full emoji search. It is the `reactionPicker` of a board card and the
 * last chip of a survey.
 */
export function AddReaction({
    onPick,
    emojiData,
}: {
    onPick: (emoji: string) => void;
    emojiData?: EmojiDataLocation;
}) {
    const { t } = useTrans();

    return (
        <EmojiPicker
            label={t('Add a reaction')}
            onPick={onPick}
            emojiData={emojiData}
        >
            <button
                type="button"
                data-slot="add-reaction"
                className="inline-flex h-6 shrink-0 items-center rounded-full border border-dashed border-input bg-card px-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                <SmilePlus className="size-3.5" aria-hidden />
            </button>
        </EmojiPicker>
    );
}

/** The reaction chips of something that is not a board card: a survey, the presented card. */
export function ReactionChips({ reactions, canReact, onToggle }: Props) {
    const { t } = useTrans();

    return (
        <div
            {...dragIsolation}
            data-slot="reaction-chips"
            className="flex flex-wrap items-center gap-1.5"
        >
            {reactions.map((reaction) => (
                <Tooltip key={reaction.emoji}>
                    <TooltipTrigger asChild>
                        <span
                            tabIndex={canReact ? -1 : 0}
                            className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <button
                                type="button"
                                aria-pressed={reaction.mine}
                                aria-label={
                                    reaction.count === 1
                                        ? t(':emoji, :count reaction', {
                                              emoji: reaction.emoji,
                                              count: reaction.count,
                                          })
                                        : t(':emoji, :count reactions', {
                                              emoji: reaction.emoji,
                                              count: reaction.count,
                                          })
                                }
                                disabled={!canReact}
                                onClick={() => onToggle(reaction.emoji)}
                                className={cn(
                                    'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                                    reaction.mine
                                        ? 'border-transparent bg-skrum-primary-soft text-skrum-primary-text'
                                        : 'border-input bg-card text-foreground',
                                )}
                            >
                                <span aria-hidden>{reaction.emoji}</span>
                                <span aria-hidden>{reaction.count}</span>
                            </button>
                        </span>
                    </TooltipTrigger>
                    {reaction.names.length > 0 && (
                        <TooltipContent>
                            {reaction.names.join(', ')}
                        </TooltipContent>
                    )}
                </Tooltip>
            ))}
            {canReact && <AddReaction onPick={onToggle} />}
        </div>
    );
}

export function optimisticReactions(
    reactions: ReactionSummary[],
    emoji: string,
    removing: boolean,
): ReactionSummary[] {
    const existing = reactions.find((reaction) => reaction.emoji === emoji);

    if (removing && existing) {
        return reactions
            .map((reaction) =>
                reaction.emoji === emoji
                    ? { ...reaction, count: reaction.count - 1, mine: false }
                    : reaction,
            )
            .filter((reaction) => reaction.count > 0);
    }

    if (existing) {
        return reactions.map((reaction) =>
            reaction.emoji === emoji
                ? { ...reaction, count: reaction.count + 1, mine: true }
                : reaction,
        );
    }

    return [...reactions, { emoji, count: 1, mine: true, names: [] }];
}
