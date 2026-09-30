import { useState } from 'react';
import RetroHighlightsController from '@/actions/App/Http/Controllers/Retros/RetroHighlightsController';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf } from '@/lib/retro/board-reducer';
import type { BoardCard } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { CardComments } from './card-comments';
import { CardGif } from './card-gif';
import { CardReactions } from './card-reactions';

function PresentedContent({
    card,
    className,
}: {
    card: BoardCard;
    className: string;
}) {
    if (card.hidden) {
        return null;
    }

    return (
        <>
            {card.gif && <CardGif gif={card.gif} />}
            {card.content !== null && (
                <p className={className}>{card.content}</p>
            )}
        </>
    );
}

export function PresentationOverlay() {
    const ctx = useBoard();
    const { board } = ctx;
    const { t } = useTrans();
    const { retro, viewer } = board;
    const highlightedCardId = retro.highlightedCardId;
    const [dismissed, setDismissed] = useState(false);
    const [trackedCardId, setTrackedCardId] = useState(highlightedCardId);
    const [stopping, setStopping] = useState(false);

    if (trackedCardId !== highlightedCardId) {
        setTrackedCardId(highlightedCardId);
        setDismissed(false);
    }

    const card = board.cards.find(
        (candidate) => candidate.id === highlightedCardId,
    );

    if (!card) {
        return null;
    }

    const open =
        retro.presentationMode &&
        retro.phase === 'discussing' &&
        !card.hidden &&
        !dismissed;

    const stopPresenting = async () => {
        if (stopping) {
            return;
        }

        setStopping(true);

        const response = await ctx.run(
            retroRequest<{ highlightedCardId: string | null }>(
                RetroHighlightsController.update(retro.id),
                { card_id: null },
            ),
        );

        setStopping(false);

        if (response) {
            ctx.apply({
                type: 'highlight.set',
                cardId: response.highlightedCardId,
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (isOpen) {
                    return;
                }

                if (viewer.isFacilitator) {
                    void stopPresenting();

                    return;
                }

                setDismissed(true);
            }}
        >
            <DialogContent aria-describedby={undefined} className="max-w-3xl">
                <DialogTitle className="sr-only">
                    {t('Presentation mode')}
                </DialogTitle>
                {card.groupName && (
                    <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                        {card.groupName}
                    </p>
                )}
                <PresentedContent
                    card={card}
                    className="text-2xl break-words whitespace-pre-wrap"
                />
                {childrenOf(board.cards, card.id).map((child) => (
                    <div
                        key={child.id}
                        className="space-y-2 border-l-2 pl-3 text-lg text-muted-foreground"
                    >
                        <PresentedContent
                            card={child}
                            className="break-words whitespace-pre-wrap"
                        />
                    </div>
                ))}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {card.author && <span>{card.author.name}</span>}
                    {card.votes !== null && (
                        <span>
                            {t(
                                card.votes === 1
                                    ? ':count vote'
                                    : ':count votes',
                                { count: card.votes },
                            )}
                        </span>
                    )}
                </div>
                <CardReactions card={card} />
                <CardComments card={card} />
                {viewer.isFacilitator && (
                    <Button
                        variant="outline"
                        className="self-end"
                        disabled={stopping}
                        onClick={() => void stopPresenting()}
                    >
                        {t('Stop presenting')}
                    </Button>
                )}
            </DialogContent>
        </Dialog>
    );
}
