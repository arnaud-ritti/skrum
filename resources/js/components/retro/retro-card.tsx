import { Crosshair, EyeOff, Pencil, Trash2, Ungroup } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import RetroHighlightsController from '@/actions/App/Http/Controllers/Retros/RetroHighlightsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf } from '@/lib/retro/board-reducer';
import type { BoardCard, CardPayload } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { CardEditor } from './card-editor';
import { VoteControls } from './vote-controls';

type Props = {
    card: BoardCard;
    isChild?: boolean;
    footer?: ReactNode;
};

export function RetroCard({ card, isChild = false, footer }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [highlighting, setHighlighting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const removeInFlight = useRef(false);
    const phase = ctx.board.retro.phase;
    const canChange =
        ctx.isEditable &&
        card.isMine &&
        (phase === 'writing' || phase === 'grouping');
    const isHighlighted = ctx.board.retro.highlightedCardId === card.id;

    const remove = async () => {
        if (removeInFlight.current) {
            return;
        }

        removeInFlight.current = true;
        setRemoving(true);

        const result = await ctx
            .run(
                retroRequest(
                    CardsController.destroy({
                        retro: ctx.board.retro.id,
                        card: card.id,
                    }),
                ),
            )
            .finally(() => {
                removeInFlight.current = false;
                setRemoving(false);
            });

        if (result !== undefined) {
            ctx.apply({
                type: 'card.remove',
                cardId: card.id,
                ungroupedCards: [],
            });
            await ctx.refetch();
        }
    };

    const toggleHighlight = async () => {
        setHighlighting(true);

        const response = await ctx.run(
            retroRequest<{ highlightedCardId: string | null }>(
                RetroHighlightsController.update(ctx.board.retro.id),
                { card_id: isHighlighted ? null : card.id },
            ),
        );

        setHighlighting(false);

        if (response) {
            ctx.apply({
                type: 'highlight.set',
                cardId: response.highlightedCardId,
            });
        }
    };

    const ungroup = async () => {
        const response = await ctx.run(
            retroRequest<{ cards: CardPayload[] }>(
                CardGroupsController.destroy({
                    retro: ctx.board.retro.id,
                    card: card.id,
                }),
            ),
        );

        if (response) {
            ctx.apply({ type: 'cards.upsert', cards: response.cards });
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
                    editable={canChange}
                    onDone={() => setEditing(false)}
                />
            ) : (
                <>
                    {card.hidden ? (
                        <p className="flex items-center gap-1.5 text-muted-foreground italic">
                            <EyeOff className="size-4" aria-hidden="true" />
                            {t('Hidden until writing ends')}
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
                            {!isChild && phase === 'voting' && (
                                <VoteControls card={card} />
                            )}
                            {!isChild &&
                                ((phase === 'voting' && card.votes !== null) ||
                                    phase === 'discussing' ||
                                    phase === 'completed') && (
                                    <Badge
                                        variant="secondary"
                                        aria-label={t(
                                            card.votes === 1
                                                ? ':count vote'
                                                : ':count votes',
                                            { count: card.votes ?? 0 },
                                        )}
                                    >
                                        {card.votes ?? 0}
                                    </Badge>
                                )}
                            {!isChild &&
                                phase === 'discussing' &&
                                ctx.board.viewer.isFacilitator && (
                                    <Button
                                        size="sm"
                                        variant={
                                            isHighlighted ? 'default' : 'ghost'
                                        }
                                        className="h-7"
                                        aria-pressed={isHighlighted}
                                        disabled={highlighting}
                                        onClick={() => void toggleHighlight()}
                                    >
                                        <Crosshair className="size-3.5" />
                                        {t('Discuss')}
                                    </Button>
                                )}
                            {isChild &&
                                phase === 'grouping' &&
                                ctx.isEditable && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-7"
                                        aria-label={t('Ungroup')}
                                        onClick={() => void ungroup()}
                                    >
                                        <Ungroup className="size-3.5" />
                                    </Button>
                                )}
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
                                        disabled={removing}
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
                        <RetroCard card={child} isChild />
                    </div>
                ))}
        </article>
    );
}

export function CardPreview({
    card,
    width,
}: {
    card: BoardCard;
    width: number | undefined;
}) {
    const { t } = useTrans();

    return (
        <article
            className={cn(
                'rounded-md border bg-card p-3 text-sm shadow-lg',
                width === undefined && 'w-64',
            )}
            style={{ width }}
        >
            {card.hidden ? (
                <p className="text-muted-foreground italic">
                    {t('Hidden until writing ends')}
                </p>
            ) : (
                <p className="break-words whitespace-pre-wrap">
                    {card.content}
                </p>
            )}
            {card.author && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {card.author.name}
                </p>
            )}
        </article>
    );
}
