import { Layers } from 'lucide-react';
import { useRef, useState } from 'react';
import CardGroupsController from '@/actions/App/Http/Controllers/Retros/CardGroupsController';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf, topLevelCards } from '@/lib/retro/board-reducer';
import type { BoardCard, CardPayload } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

/**
 * Where a card of the column can go: the groups first, then the cards that
 * are still alone.
 */
export function groupTargets(
    card: Pick<BoardCard, 'id' | 'columnId'>,
    cards: BoardCard[],
): { card: BoardCard; size: number }[] {
    return topLevelCards(cards, card.columnId)
        .filter((candidate) => candidate.id !== card.id && !candidate.hidden)
        .map((candidate) => ({
            card: candidate,
            size: childrenOf(cards, candidate.id).length + 1,
        }))
        .sort((a, b) => Number(b.size > 1) - Number(a.size > 1));
}

/**
 * "Add to group…" of a card on a phone, where a card is not dragged onto
 * another: the groups and the cards of its column, one press away.
 */
export function GroupTargetDrawer({
    card,
    open,
    onOpenChange,
}: {
    card: BoardCard;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const inFlight = useRef(false);
    const [pending, setPending] = useState(false);
    const { board } = ctx;
    const targets = groupTargets(card, board.cards);
    const color =
        board.columns.find((column) => column.id === card.columnId)?.color ??
        'moss';

    const group = async (target: BoardCard) => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;
        setPending(true);

        const response = await ctx.run(
            retroRequest<{ cards: CardPayload[] }>(
                CardGroupsController.update({
                    retro: board.retro.id,
                    card: card.id,
                }),
                { parent_card_id: target.id },
            ),
        );

        inFlight.current = false;
        setPending(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'cards.upsert', cards: response.cards });
        onOpenChange(false);
    };

    return (
        <Drawer open={open && !ctx.sessionExpired} onOpenChange={onOpenChange}>
            <DrawerContent {...dragIsolation} data-slot="retro-group-drawer">
                <DrawerHeader className="pr-10 text-left">
                    <DrawerTitle>{t('Add to a group')}</DrawerTitle>
                    <DrawerDescription className="line-clamp-2 wrap-anywhere">
                        {card.content || t('GIF')}
                    </DrawerDescription>
                </DrawerHeader>
                {targets.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">
                        {t('No other card in this column.')}
                    </p>
                ) : (
                    <ul
                        aria-busy={pending}
                        className={cn(
                            columnColorClass(color),
                            'scrollbar-themed flex min-h-0 flex-col gap-2 overflow-y-auto p-0.5',
                        )}
                    >
                        {targets.map(({ card: target, size }) => (
                            <li key={target.id} className="min-w-0">
                                <button
                                    type="button"
                                    data-target-id={target.id}
                                    disabled={pending}
                                    className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-(--col-border) bg-(--col) px-3 py-2 text-left text-sm font-medium text-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
                                    onClick={() => void group(target)}
                                >
                                    {size > 1 && (
                                        <Layers
                                            className="size-4 shrink-0 text-(--col-text)"
                                            aria-hidden
                                        />
                                    )}
                                    <span className="line-clamp-2 min-w-0 flex-1 wrap-anywhere">
                                        {(size > 1 && target.groupName) ||
                                            target.content ||
                                            t('GIF')}
                                    </span>
                                    {size > 1 && (
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {t(':count cards', { count: size })}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </DrawerContent>
        </Drawer>
    );
}
