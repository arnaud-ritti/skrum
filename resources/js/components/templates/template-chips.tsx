import { columnSwatch } from '@/lib/retro/colors';
import { cn } from '@/lib/utils';
import type { TemplateColumn } from '@/types';

type Props = {
    columns: TemplateColumn[];
    withDescriptions?: boolean;
};

export function TemplateChips({ columns, withDescriptions = false }: Props) {
    if (withDescriptions) {
        return (
            <ul className="space-y-3">
                {columns.map((column, index) => (
                    <li key={index} className="flex gap-2">
                        <span
                            className={cn(
                                'mt-1.5 size-2.5 shrink-0 rounded-full',
                                columnSwatch[column.color],
                            )}
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words">
                                {column.title}
                            </p>
                            {column.description && (
                                <p className="text-xs text-muted-foreground">
                                    {column.description}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {columns.map((column, index) => (
                <span
                    key={index}
                    className="inline-flex max-w-48 items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                    <span
                        className={cn(
                            'size-2 shrink-0 rounded-full',
                            columnSwatch[column.color],
                        )}
                    />
                    <span className="truncate">{column.title}</span>
                </span>
            ))}
        </div>
    );
}
