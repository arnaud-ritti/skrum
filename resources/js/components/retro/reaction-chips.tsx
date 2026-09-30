import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { ReactionSummary } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { dragIsolation } from './dnd';
import { EmojiPicker } from './emoji-picker';

type Props = {
    reactions: ReactionSummary[];
    canReact: boolean;
    onToggle: (emoji: string) => void;
};

export function ReactionChips({ reactions, canReact, onToggle }: Props) {
    const { t } = useTrans();

    return (
        <div
            {...dragIsolation}
            className="mt-2 flex flex-wrap items-center gap-1"
        >
            {reactions.map((reaction) => (
                <Tooltip key={reaction.emoji}>
                    <TooltipTrigger asChild>
                        <span
                            tabIndex={canReact ? -1 : 0}
                            className="inline-flex"
                        >
                            <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                    'h-6 gap-1 rounded-full px-2 text-xs',
                                    reaction.mine &&
                                        'border-primary bg-primary/10',
                                )}
                                aria-pressed={reaction.mine}
                                aria-label={t(
                                    reaction.count === 1
                                        ? ':emoji, :count reaction'
                                        : ':emoji, :count reactions',
                                    {
                                        emoji: reaction.emoji,
                                        count: reaction.count,
                                    },
                                )}
                                disabled={!canReact}
                                onClick={() => onToggle(reaction.emoji)}
                            >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                            </Button>
                        </span>
                    </TooltipTrigger>
                    {reaction.names.length > 0 && (
                        <TooltipContent>
                            {reaction.names.join(', ')}
                        </TooltipContent>
                    )}
                </Tooltip>
            ))}
            {canReact && (
                <EmojiPicker label={t('Add a reaction')} onPick={onToggle}>
                    <Button size="icon" variant="ghost" className="size-6">
                        <SmilePlus className="size-3.5" />
                    </Button>
                </EmojiPicker>
            )}
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
