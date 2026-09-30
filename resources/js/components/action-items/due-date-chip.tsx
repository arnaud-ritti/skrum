import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { formatDueDate } from '@/lib/action-items/format';
import type { ActionItem } from '@/lib/retro/types';

export function DueDateChip({
    item,
}: {
    item: Pick<ActionItem, 'dueOn' | 'isOverdue'>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (item.dueOn === null) {
        return null;
    }

    const date = formatDueDate(item.dueOn, locale);

    if (item.isOverdue) {
        return (
            <Badge variant="destructive">
                {t('Overdue')} · {date}
            </Badge>
        );
    }

    return (
        <Badge variant="outline" className="font-normal">
            {t('Due :date', { date })}
        </Badge>
    );
}
