import { topLevelCards } from '@/lib/retro/board-reducer';
import { columnAccent } from '@/lib/retro/colors';
import type { BoardColumn } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { BoardContextValue } from './board';
import { CardComposer } from './card-composer';
import { ColumnHeader } from './column-header';
import { RetroCard } from './retro-card';

export function RetroColumn({
    column,
    ctx,
}: {
    column: BoardColumn;
    ctx: BoardContextValue;
}) {
    const cards = topLevelCards(ctx.board.cards, column.id);

    return (
        <section
            className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30 p-3',
                columnAccent[column.color],
            )}
        >
            <ColumnHeader column={column} count={cards.length} />
            <div className="flex flex-col gap-2">
                {cards.map((card) => (
                    <RetroCard key={card.id} card={card} ctx={ctx} />
                ))}
            </div>
            {ctx.board.retro.phase === 'writing' && (
                <div className="mt-3">
                    <CardComposer columnId={column.id} ctx={ctx} />
                </div>
            )}
        </section>
    );
}
