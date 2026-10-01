import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowDownWideNarrow } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { sortByVotes, topLevelCards } from '@/lib/retro/board-reducer';
import { columnAccent } from '@/lib/retro/colors';
import type { BoardColumn } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { CardComposer } from './card-composer';
import { ColumnHeader } from './column-header';
import { ColumnDropZone, GroupableCard, SortableCard } from './dnd';
import { RetroCard } from './retro-card';

export function RetroColumn({
    column,
    index,
}: {
    column: BoardColumn;
    index: number;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [isSortedByVotes, setIsSortedByVotes] = useState(true);
    const phase = ctx.board.retro.phase;
    const canSortByVotes = phase === 'discussing' || phase === 'completed';
    const orderedCards = topLevelCards(ctx.board.cards, column.id);
    const cards =
        canSortByVotes && isSortedByVotes
            ? sortByVotes(orderedCards)
            : orderedCards;

    const renderCard = (card: (typeof cards)[number]) => {
        const content = <RetroCard card={card} />;

        if (phase === 'writing') {
            return (
                <SortableCard
                    key={card.id}
                    id={card.id}
                    disabled={!ctx.isEditable || !card.isMine}
                >
                    {content}
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
                    {content}
                </GroupableCard>
            );
        }

        return <div key={card.id}>{content}</div>;
    };

    return (
        <section
            data-test={`retro-column-${column.id}`}
            className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30 p-3',
                columnAccent[column.color],
            )}
        >
            <ColumnDropZone
                id={column.id}
                className="flex flex-col gap-2 rounded-md"
            >
                <ColumnHeader
                    column={column}
                    count={cards.length}
                    index={index}
                    total={ctx.board.columns.length}
                    hasCards={ctx.board.cards.some(
                        (card) => card.columnId === column.id,
                    )}
                />
                {canSortByVotes && (
                    <Button
                        size="sm"
                        variant={isSortedByVotes ? 'secondary' : 'ghost'}
                        className="self-start"
                        data-test="retro-sort-by-votes"
                        aria-pressed={isSortedByVotes}
                        onClick={() =>
                            setIsSortedByVotes((current) => !current)
                        }
                    >
                        <ArrowDownWideNarrow className="size-3.5" />
                        {t('Sort by votes')}
                    </Button>
                )}
                {phase === 'grouping' && (
                    <p className="text-xs text-muted-foreground">
                        {t('Drag cards onto each other to group them.')}
                    </p>
                )}
                <div className="flex min-h-12 flex-col gap-2">
                    {phase === 'writing' ? (
                        <SortableContext
                            items={cards.map((card) => `card:${card.id}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            {cards.map(renderCard)}
                        </SortableContext>
                    ) : (
                        cards.map(renderCard)
                    )}
                </div>
            </ColumnDropZone>
            {phase === 'writing' && ctx.isEditable && (
                <div className="mt-3">
                    <CardComposer columnId={column.id} />
                </div>
            )}
        </section>
    );
}
