import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DateRange } from 'react-day-picker';
import type { BenchGroup } from '@/components/dev/bench';
import { DatePicker, DateRangeFilter } from '@/components/skrum/date-picker';
import type {
    DateRangePreset,
    DateRangeValue,
    DateShortcut,
} from '@/components/skrum/date-picker';
import { Calendar } from '@/components/ui/calendar';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

const isWeekend = (date: Date): boolean =>
    date.getDay() === 0 || date.getDay() === 6;

export default function DatePickerSection() {
    const { t } = useTrans();
    const { locale: appLocale } = usePage().props;
    const locale = appLocale === 'fr' ? 'fr' : 'en';
    const today = new Date();
    const [single, setSingle] = useState<Date | undefined>(addDays(today, 3));
    const [range, setRange] = useState<DateRange | undefined>({
        from: addDays(today, 2),
        to: addDays(today, 6),
    });
    const [empty, setEmpty] = useState<Date | undefined>();
    const [filled, setFilled] = useState<Date | undefined>(addDays(today, 5));
    const [withShortcuts, setWithShortcuts] = useState<Date | undefined>();
    const [typing, setTyping] = useState<Date | undefined>();
    const [late, setLate] = useState<Date | undefined>(addDays(today, -2));
    const [invalid, setInvalid] = useState<Date | undefined>();
    const [french, setFrench] = useState<Date | undefined>(addDays(today, 1));
    const shortcuts: DateShortcut[] = [
        { label: t('Today'), date: today },
        { label: t('Tomorrow'), date: addDays(today, 1) },
        { label: t('In 1 week'), date: addDays(today, 7) },
        { label: t('End of sprint'), date: addDays(today, 10) },
        { label: t('No date'), date: null },
    ];
    const presets: DateRangePreset[] = [
        {
            label: t('This sprint'),
            range: { from: addDays(today, -4), to: addDays(today, 7) },
        },
        {
            label: t('Previous sprint'),
            range: { from: addDays(today, -18), to: addDays(today, -5) },
        },
        {
            label: t('Last 30 days'),
            range: { from: addDays(today, -29), to: today },
        },
    ];
    const [dueRange, setDueRange] = useState<DateRangeValue | undefined>(
        presets[0].range,
    );
    const [createdRange, setCreatedRange] = useState<
        DateRangeValue | undefined
    >();
    const noop = () => {};

    return (
        <section className="@container grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <State
                label={t(
                    'DateRangeFilter: active pill with remove button, open with presets and the range footer',
                )}
            >
                <div className="flex min-h-112 flex-wrap items-start gap-2">
                    <DateRangeFilter
                        label={t('Due')}
                        locale={locale}
                        value={dueRange}
                        presets={presets}
                        onApply={setDueRange}
                        defaultOpen
                    />
                </div>
            </State>
            <State label={t('DateRangeFilter: no range yet, no presets')}>
                <div className="flex flex-wrap items-start gap-2">
                    <DateRangeFilter
                        label={t('Created')}
                        locale={locale}
                        value={createdRange}
                        onApply={setCreatedRange}
                    />
                    <DateRangeFilter
                        label={t(
                            'A very long filter label that must truncate in a narrow toolbar',
                        )}
                        locale={locale}
                        value={presets[2].range}
                        onApply={noop}
                    />
                </div>
            </State>
            <State label={t('Calendar: single selection, weekends disabled')}>
                <Calendar
                    mode="single"
                    locale={locale}
                    selected={single}
                    onSelect={setSingle}
                    disabled={isWeekend}
                />
            </State>
            <State label={t('Calendar: range with start, middle and end')}>
                <Calendar
                    mode="range"
                    locale={locale}
                    selected={range}
                    onSelect={setRange}
                />
            </State>
            <State label={t('Calendar: French, week starts on Monday')}>
                <Calendar
                    mode="single"
                    locale="fr"
                    selected={single}
                    onSelect={setSingle}
                />
            </State>
            <State label={t('Calendar: English, week starts on Sunday')}>
                <Calendar
                    mode="single"
                    locale="en"
                    selected={single}
                    onSelect={setSingle}
                />
            </State>
            <State label={t('DatePicker: empty with placeholder')}>
                <DatePicker
                    label={t('Due date')}
                    value={empty}
                    onValueChange={setEmpty}
                    locale={locale}
                />
            </State>
            <State label={t('DatePicker: filled')}>
                <DatePicker
                    label={t('Due date')}
                    value={filled}
                    onValueChange={setFilled}
                    locale={locale}
                />
            </State>
            <State label={t('DatePicker: with shortcuts (open it)')}>
                <DatePicker
                    label={t('Due date')}
                    value={withShortcuts}
                    onValueChange={setWithShortcuts}
                    locale={locale}
                    shortcuts={shortcuts}
                />
            </State>
            <State label={t('DatePicker: typing allowed')}>
                <DatePicker
                    label={t('Expiry date')}
                    value={typing}
                    onValueChange={setTyping}
                    locale={locale}
                    allowTyping
                />
            </State>
            <State label={t('DatePicker: overdue')}>
                <DatePicker
                    label={t('Due date')}
                    value={late}
                    onValueChange={setLate}
                    locale={locale}
                    overdue
                />
            </State>
            <State label={t('DatePicker: invalid')}>
                <DatePicker
                    label={t('Retro date')}
                    value={invalid}
                    onValueChange={setInvalid}
                    locale={locale}
                    error={t('Pick a date for the retrospective')}
                />
            </State>
            <State label={t('DatePicker: disabled')}>
                <DatePicker
                    label={t('Due date')}
                    value={addDays(today, 4)}
                    onValueChange={noop}
                    locale={locale}
                    disabled
                />
            </State>
            <State label={t('DatePicker: French locale, weekends disabled')}>
                <DatePicker
                    label={t('Due date')}
                    value={french}
                    onValueChange={setFrench}
                    locale="fr"
                    isDateDisabled={isWeekend}
                />
            </State>
        </section>
    );
}
