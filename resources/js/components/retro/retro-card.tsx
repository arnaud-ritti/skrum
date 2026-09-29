import { Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf } from '@/lib/retro/board-reducer';
import type { BoardCard } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { BoardContextValue } from './board';
import { CardEditor } from './card-editor';

type Props = {
    card: BoardCard;
    ctx: BoardContextValue;
    isChild?: boolean;
    footer?: ReactNode;
};

export function RetroCard({ card, ctx, isChild = false, footer }: Props) {
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const phase = ctx.board.retro.phase;
    const canChange =
        card.isMine && (phase === 'writing' || phase === 'grouping');
    const isHighlighted = ctx.board.retro.highlightedCardId === card.id;

    const remove = async () => {
        const result = await ctx.run(
            retroRequest(
                CardsController.destroy({
                    retro: ctx.board.retro.id,
                    card: card.id,
                }),
            ),
        );

        if (result !== undefined) {
            ctx.dispatch({
                type: 'card.remove',
                cardId: card.id,
                ungroupedCards: [],
            });
            await ctx.refetch();
        }
    };

    return (
        <article
            id={`card-${card.id}`}
            className={cn(
                'rounded-md border bg-card p-3 text-sm shadow-xs',
                isChild && 'ml-3 border-dashed p-2 text-xs',
                isHighlighted && 'ring-2 ring-primary',
            )}
        >
            {editing ? (
                <CardEditor
                    card={card}
                    ctx={ctx}
                    onDone={() => setEditing(false)}
                />
            ) : (
                <>
                    {card.content === null ? (
                        <p className="text-muted-foreground italic">
                            {t('Someone is writing…')}
                        </p>
                    ) : (
                        <p className="break-words whitespace-pre-wrap">
                            {card.content}
                        </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {card.author && <span>{card.author.name}</span>}
                        {card.isMine && (
                            <Badge variant="secondary">{t('You')}</Badge>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                            {footer}
                            {canChange && (
                                <>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-7"
                                        aria-label={t('Edit card')}
                                        onClick={() => setEditing(true)}
                                    >
                                        <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-7"
                                        aria-label={t('Delete card')}
                                        onClick={() => void remove()}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
            {!isChild &&
                childrenOf(ctx.board.cards, card.id).map((child) => (
                    <div key={child.id} className="mt-2">
                        <RetroCard card={child} ctx={ctx} isChild />
                    </div>
                ))}
        </article>
    );
}
