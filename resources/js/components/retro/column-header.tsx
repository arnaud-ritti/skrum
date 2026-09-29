import type { BoardColumn } from '@/lib/retro/types';

export function ColumnHeader({
    column,
    count,
}: {
    column: BoardColumn;
    count: number;
}) {
    return (
        <header className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{column.title}</h2>
            <span className="text-xs text-muted-foreground">{count}</span>
        </header>
    );
}
