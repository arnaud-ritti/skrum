import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ColumnOrdersController from '@/actions/App/Http/Controllers/Retros/ColumnOrdersController';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
import { RetroColumn } from '@/components/skrum/retro-column';
import { useTrans } from '@/hooks/use-trans';
import { toColumnProps } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import { sortByVotes, topLevelCards } from '@/lib/retro/board-reducer';
import type {
    BoardCard as BoardCardData,
    BoardColumn as BoardColumnData,
    ColumnColor,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { BoardCard, CardComposer } from './board-card';
import { useBoard } from './board-context';
import { BoardGroup } from './board-group';
import {
    GroupableCard,
    SortableCard,
    useColumnDropZone,
    type CardDragState,
} from './dnd';

type ColumnsResponse = { columns: BoardColumnData[] };

type ColumnPatch = {
    title?: string;
    color?: ColumnColor;
    description?: string | null;
};

/** Thrown to a dialog of the column so that it stays open when the server refuses. */
class ColumnChangeRefused extends Error {}

export function BoardColumn({
    column,
    typing,
    moving,
    className,
    onAdd,
}: {
    column: BoardColumnData;
    className?: string;
    /**
     * The host writes the new card somewhere else (the drawer of the phone
     * board): the column then has no card open for writing.
     */
    onAdd?: () => void;
    /** Place of the "… is writing a card" line of the Writing mockup (RT-1). */
    typing?: ReactNode;
    /** Place of the "… is moving a card" line of the Grouping mockup (RT-1). */
    moving?: ReactNode;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const sectionRef = useRef<HTMLElement | null>(null);
    const drop = useColumnDropZone(column.id);
    const [isSortedByVotes, setIsSortedByVotes] = useState(true);
    const busy = useRef(false);
    const props = toColumnProps(column, ctx.board);
    const { hasCards, canManage, ...columnProps } = props;
    const { phase } = ctx.board.retro;
    const retroId = ctx.board.retro.id;
    // Discussing shows the topics, not the columns: the Board tab of a
    // completed retro is the only place left for this order.
    const canSortByVotes = phase === 'completed';
    const orderedCards = topLevelCards(ctx.board.cards, column.id);
    const cards =
        canSortByVotes && isSortedByVotes
            ? sortByVotes(orderedCards)
            : orderedCards;

    const applyColumns = async (request: () => Promise<ColumnsResponse>) => {
        if (busy.current) {
            return undefined;
        }

        busy.current = true;

        const response = await ctx.run(request());

        busy.current = false;

        if (response) {
            ctx.apply({ type: 'columns.set', columns: response.columns });
        }

        return response;
    };

    const update = (patch: ColumnPatch) =>
        applyColumns(() =>
            retroRequest<ColumnsResponse>(
                ColumnsController.update({ retro: retroId, column: column.id }),
                patch,
            ),
        );

    const move = (offset: -1 | 1) => {
        const ids = ctx.board.columns.map((item) => item.id);
        const from = ids.indexOf(column.id);

        [ids[from], ids[from + offset]] = [ids[from + offset], ids[from]];

        return applyColumns(() =>
            retroRequest<ColumnsResponse>(
                ColumnOrdersController.update(retroId),
                { column_ids: ids },
            ),
        );
    };

    const settle = async (change: Promise<ColumnsResponse | undefined>) => {
        if ((await change) === undefined) {
            throw new ColumnChangeRefused();
        }
    };

    const leadIds = new Set(
        ctx.board.cards.flatMap((card) =>
            card.parentCardId === null ? [] : [card.parentCardId],
        ),
    );

    /** A card alone, or the group it leads. */
    const draw = (card: BoardCardData, drag?: CardDragState) =>
        leadIds.has(card.id) ? (
            <BoardGroup lead={card} drag={drag} />
        ) : (
            <BoardCard card={card} drag={drag} />
        );

    const renderCard = (card: BoardCardData) => {
        if (phase === 'writing') {
            return (
                <SortableCard
                    key={card.id}
                    id={card.id}
                    disabled={!ctx.isEditable || !card.isMine}
                >
                    {(drag) => <BoardCard card={card} drag={drag} />}
                </SortableCard>
            );
        }

        if (phase === 'grouping') {
            return (
                <GroupableCard
                    key={card.id}
                    id={card.id}
                    disabled={!ctx.isEditable}
                >
                    {(drag) => draw(card, drag)}
                </GroupableCard>
            );
        }

        return <Fragment key={card.id}>{draw(card)}</Fragment>;
    };

    const focusComposer = () => {
        sectionRef.current
            ?.querySelector<HTMLTextAreaElement>(
                '[data-slot="retro-card-composer"] textarea',
            )
            ?.focus();
    };

    return (
        <RetroColumn
            {...columnProps}
            ref={(node) => {
                sectionRef.current = node;
                drop.setNodeRef(node);
            }}
            data-test={`retro-column-${column.id}`}
            className={cn('max-w-85 min-w-column flex-1 basis-0', className)}
            isDropTarget={drop.isOver}
            editDisabledReason={
                hasCards
                    ? t(
                          'Only empty columns can be renamed, recoloured or deleted.',
                      )
                    : undefined
            }
            sortedByVotes={isSortedByVotes}
            onSortByVotesChange={
                canSortByVotes ? setIsSortedByVotes : undefined
            }
            onAdd={onAdd ?? focusComposer}
            composer={
                onAdd ? null : (
                    <CardComposer columnId={column.id} color={column.color} />
                )
            }
            {...(canManage && {
                onRename: (title: string) => void update({ title }),
                onColorChange: (color: ColumnColor) => void update({ color }),
                onDescriptionChange: (description: string | null) =>
                    settle(update({ description })),
                onMove: (direction: -1 | 1) => void move(direction),
                onDelete: () =>
                    settle(
                        applyColumns(() =>
                            retroRequest<ColumnsResponse>(
                                ColumnsController.destroy({
                                    retro: retroId,
                                    column: column.id,
                                }),
                            ),
                        ),
                    ),
            })}
        >
            {phase === 'writing' && cards.length > 0 ? (
                <SortableContext
                    items={cards.map((card) => `card:${card.id}`)}
                    strategy={verticalListSortingStrategy}
                >
                    {cards.map(renderCard)}
                </SortableContext>
            ) : (
                cards.map(renderCard)
            )}
            {typing}
            {moving}
        </RetroColumn>
    );
}
