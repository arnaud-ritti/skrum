import CardReactionsController from '@/actions/App/Http/Controllers/Retros/CardReactionsController';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, ReactionSummary } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { optimisticReactions, ReactionChips } from './reaction-chips';

type Response = { cardId: string; reactions: ReactionSummary[] };

const ReactionPhases = ['grouping', 'voting', 'discussing'];

export function CardReactions({ card }: { card: BoardCard }) {
    const ctx = useBoard();
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
            reactions: optimisticReactions(card.reactions, emoji, removing),
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
        <ReactionChips
            reactions={card.reactions}
            canReact={canReact}
            onToggle={(emoji) => void toggle(emoji)}
        />
    );
}
