import { SmilePlus } from 'lucide-react';
import CardReactionsController from '@/actions/App/Http/Controllers/Retros/CardReactionsController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, ReactionSummary } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';
import { EmojiPicker } from './emoji-picker';

type Response = { cardId: string; reactions: ReactionSummary[] };

const ReactionPhases = ['grouping', 'voting', 'discussing'];

export function CardReactions({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const canReact =
        retro.reactionsEnabled &&
        ctx.isEditable &&
        ReactionPhases.includes(retro.phase);

    if (!retro.reactionsEnabled || card.hidden) {
        return null;
    }

    const toggle = async (emoji: string) => {
        const existing = card.reactions.find(
            (reaction) => reaction.emoji === emoji,
        );
        const removing = existing?.mine === true;
        const route = { retro: retro.id, card: card.id };

        ctx.dispatch({
            type: 'reactions.set',
            cardId: card.id,
            reactions: optimistic(card.reactions, emoji, removing),
        });

        const response = await ctx.run(
            retroRequest<Response>(
                removing
                    ? CardReactionsController.destroy(route)
                    : CardReactionsController.update(route),
                { emoji },
            ),
        );

        if (response) {
            ctx.apply({
                type: 'reactions.set',
                cardId: response.cardId,
                reactions: response.reactions,
            });
        }
    };

    return (
        <div
            {...dragIsolation}
            className="mt-2 flex flex-wrap items-center gap-1"
        >
            {card.reactions.map((reaction) => (
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
                                onClick={() => void toggle(reaction.emoji)}
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
                <EmojiPicker
                    label={t('Add a reaction')}
                    onPick={(emoji) => void toggle(emoji)}
                >
                    <Button size="icon" variant="ghost" className="size-6">
                        <SmilePlus className="size-3.5" />
                    </Button>
                </EmojiPicker>
            )}
        </div>
    );
}

function optimistic(
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
