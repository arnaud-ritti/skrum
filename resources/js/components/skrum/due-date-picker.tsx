import { DatePicker } from '@/components/skrum/date-picker';
import type {
    DatePickerLocale,
    DateShortcut,
} from '@/components/skrum/date-picker';
import { useTrans } from '@/hooks/use-trans';
import { localToday } from '@/lib/action-items/due';

const Locales: DatePickerLocale[] = ['fr', 'en', 'es', 'de'];

function fromIsoDay(iso: string): Date | undefined {
    if (iso === '') {
        return undefined;
    }

    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

    return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * The due date of an action item: the skrum DatePicker on the "YYYY-MM-DD"
 * string the forms keep, '' when there is none.
 */
export function DueDatePicker({
    value,
    onValueChange,
    locale,
    disabled = false,
    overdue = false,
    className,
}: {
    value: string;
    onValueChange: (value: string) => void;
    /** The language of the page; English for one the picker does not speak. */
    locale: string;
    disabled?: boolean;
    overdue?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const pickerLocale = Locales.find((known) => known === locale) ?? 'en';
    const today = new Date();
    const shortcuts: DateShortcut[] = [
        { label: t('Today'), date: today },
        { label: t('Tomorrow'), date: addDays(today, 1) },
        { label: t('In 1 week'), date: addDays(today, 7) },
        { label: t('No date'), date: null },
    ];

    return (
        <DatePicker
            label={t('Due date')}
            hideLabel
            allowTyping
            value={fromIsoDay(value)}
            onValueChange={(date) =>
                onValueChange(date === undefined ? '' : localToday(date))
            }
            locale={pickerLocale}
            shortcuts={shortcuts}
            disabled={disabled}
            overdue={overdue}
            placeholder={t('Due date')}
            className={className}
        />
    );
}
