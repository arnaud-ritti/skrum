import { usePage } from '@inertiajs/react';
import { Repeat } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItem, ActionItemRecurrence } from '@/lib/retro/types';

const DoesNotRepeat = 'none';

export const Recurrences: ActionItemRecurrence[] = [
    'weekly',
    'every_two_weeks',
    'monthly',
];

/** Translation keys, passed to t() through a variable. */
const RecurrenceLabels: Record<ActionItemRecurrence, string> = {
    weekly: 'Weekly',
    every_two_weeks: 'Every 2 weeks',
    monthly: 'Monthly',
};

/** Translation keys, passed to t() through a variable. */
const RepeatLabels: Record<ActionItemRecurrence, string> = {
    weekly: 'Repeats weekly',
    every_two_weeks: 'Repeats every 2 weeks',
    monthly: 'Repeats monthly',
};

type Props = {
    value: ActionItemRecurrence | null;
    disabled?: boolean;
    onChange: (recurrence: ActionItemRecurrence | null) => void;
};

export function RecurrenceSelect({ value, disabled, onChange }: Props) {
    const { t } = useTrans();

    return (
        <Select
            value={value ?? DoesNotRepeat}
            disabled={disabled}
            onValueChange={(next) =>
                onChange(
                    next === DoesNotRepeat
                        ? null
                        : (next as ActionItemRecurrence),
                )
            }
        >
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Repeat')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={DoesNotRepeat}>
                    {t('Does not repeat')}
                </SelectItem>
                {Recurrences.map((recurrence) => (
                    <SelectItem key={recurrence} value={recurrence}>
                        {t(RecurrenceLabels[recurrence])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function RecurrenceBadge({
    item,
}: {
    item: Pick<ActionItem, 'recurrence' | 'previousOccurrenceId' | 'createdAt'>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (item.recurrence === null) {
        return null;
    }

    return (
        <span className="flex items-center gap-1">
            <Repeat className="size-3" aria-hidden="true" />
            {t(RepeatLabels[item.recurrence])}
            {item.previousOccurrenceId && item.createdAt && (
                <span>
                    ·{' '}
                    {t('Follows up the item completed on :date', {
                        date: formatShortDate(item.createdAt, locale),
                    })}
                </span>
            )}
        </span>
    );
}
