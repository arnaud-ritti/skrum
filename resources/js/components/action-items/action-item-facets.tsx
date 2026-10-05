import {
    Calendar,
    Check,
    ChevronDown,
    SignalHigh,
    StickyNote,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
    ActionItemFilterChanges,
    ActionItemFilters,
    DueBucket,
    SourceFilter,
} from '@/components/action-items/use-action-item-filters';
import { ActionPriorityMark } from '@/components/skrum/action-item';
import {
    Command,
    CommandItem,
    CommandList,
    useCommandListId,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemPriority } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

const Any = 'any';

const DueBuckets: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

const Sources: SourceFilter[] = ['retro', 'outside'];

/**
 * Whether the facets stand in the column of a phone drawer. The filter bar
 * provides it, so that the facets a page hands it follow its layout.
 */
const StackedFacets = createContext(false);

export const StackedFacetsProvider = StackedFacets.Provider;

function FacetFrame({
    active,
    stacked,
    clearLabel,
    onClear,
    children,
}: {
    active: boolean;
    stacked: boolean;
    clearLabel?: string;
    onClear?: () => void;
    children: (clearable: boolean) => ReactNode;
}) {
    const clearable = active && onClear !== undefined;

    return (
        <div
            data-slot="action-filter"
            data-active={active ? 'true' : undefined}
            className={cn(
                'inline-flex max-w-full min-w-0 items-center rounded-md border border-dashed border-input bg-card text-body-sm font-semibold text-foreground',
                stacked ? 'h-11 w-full' : 'h-8',
                active &&
                    'border-solid border-primary bg-skrum-primary-soft text-skrum-primary-text',
            )}
        >
            {children(clearable)}
            {clearable && (
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={onClear}
                    className={cn(
                        'mr-1 inline-flex shrink-0 items-center justify-center rounded-sm outline-ring hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2',
                        stacked ? 'size-9' : 'size-6',
                    )}
                >
                    <X aria-hidden className="size-3.5" />
                </button>
            )}
        </div>
    );
}

function FacetLabel({
    icon: Icon,
    label,
    active,
    children,
}: {
    icon: LucideIcon;
    label: string;
    active: boolean;
    children: ReactNode;
}) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <Icon
                aria-hidden
                className={cn(
                    'size-3.5',
                    active ? 'text-current' : 'text-muted-foreground',
                )}
            />
            <span className="truncate">{label}</span>
            <span
                className={active ? 'min-w-0 truncate font-medium' : 'sr-only'}
            >
                {children}
            </span>
        </span>
    );
}

/** A facet of one choice: Team, Assignee, Due date, Source. */
export function SingleFacet({
    label,
    icon,
    value,
    placeholder,
    active,
    stacked,
    clearLabel,
    onValueChange,
    onClear,
    children,
}: {
    label: string;
    icon: LucideIcon;
    value: string;
    /** What the trigger reads while the value is none of the options. */
    placeholder?: string;
    active: boolean;
    stacked?: boolean;
    clearLabel?: string;
    onValueChange: (value: string) => void;
    onClear?: () => void;
    children: ReactNode;
}) {
    const inDrawer = useContext(StackedFacets);
    const isStacked = stacked ?? inDrawer;

    return (
        <FacetFrame
            active={active}
            stacked={isStacked}
            clearLabel={clearLabel}
            onClear={onClear}
        >
            {(clearable) => (
                <Select value={value} onValueChange={onValueChange}>
                    <SelectTrigger
                        size="sm"
                        aria-label={label}
                        className={cn(
                            'h-full min-w-0 flex-1 gap-1.5 border-0 bg-transparent px-2.5 text-body-sm shadow-none data-[placeholder]:text-current data-[size=sm]:h-full',
                            clearable && 'pr-1 [&>svg]:hidden',
                        )}
                    >
                        <FacetLabel icon={icon} label={label} active={active}>
                            <SelectValue placeholder={placeholder} />
                        </FacetLabel>
                    </SelectTrigger>
                    <SelectContent align="start">{children}</SelectContent>
                </Select>
            )}
        </FacetFrame>
    );
}

export type FacetOption<T extends string> = {
    value: T;
    label: string;
    mark?: ReactNode;
};

/**
 * A facet of check boxes: Status, Priority. `allValue` is what every option
 * ticked is sent as; when it is empty, none ticked means every option too,
 * otherwise the last box stays ticked.
 */
export function MultiFacet<T extends string>({
    label,
    icon,
    options,
    value,
    allValue,
    onChange,
    stacked,
    clearLabel,
    onClear,
}: {
    label: string;
    icon: LucideIcon;
    options: FacetOption<T>[];
    value: T[];
    allValue: T[];
    onChange: (value: T[]) => void;
    stacked?: boolean;
    clearLabel?: string;
    onClear?: () => void;
}) {
    const { t } = useTrans();
    const inDrawer = useContext(StackedFacets);
    const isStacked = stacked ?? inDrawer;
    const [open, setOpen] = useState(false);
    const [listId, listIdRef] = useCommandListId();
    const listNodeRef = useRef<HTMLDivElement | null>(null);
    const listRef = useCallback(
        (list: HTMLDivElement | null) => {
            listNodeRef.current = list;
            listIdRef(list);
        },
        [listIdRef],
    );
    const ticked = options.filter((option) => value.includes(option.value));
    const active = ticked.length > 0 && ticked.length < options.length;

    const toggle = (toggled: T): void => {
        const next = options
            .map((option) => option.value)
            .filter((option) =>
                option === toggled
                    ? !value.includes(option)
                    : value.includes(option),
            );

        if (next.length === 0 && allValue.length > 0) {
            return;
        }

        onChange(next.length === options.length ? allValue : next);
    };

    return (
        <FacetFrame
            active={active}
            stacked={isStacked}
            clearLabel={clearLabel}
            onClear={onClear}
        >
            {(clearable) => (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            role="combobox"
                            aria-label={label}
                            aria-haspopup="listbox"
                            aria-expanded={open}
                            aria-controls={open ? listId : undefined}
                            className={cn(
                                'flex h-full min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md px-2.5 text-body-sm outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 data-[state=open]:ring-0',
                                clearable && 'pr-1',
                            )}
                        >
                            <FacetLabel
                                icon={icon}
                                label={label}
                                active={active}
                            >
                                {active &&
                                    (ticked.length === 1
                                        ? ticked[0].label
                                        : t(':count of :total', {
                                              count: ticked.length,
                                              total: options.length,
                                          }))}
                            </FacetLabel>
                            {!clearable && (
                                <ChevronDown
                                    aria-hidden
                                    className="size-4 shrink-0 opacity-50"
                                />
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-56 overflow-hidden rounded-lg p-0 shadow-popover"
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            listNodeRef.current?.focus();
                        }}
                    >
                        <Command className="outline-none">
                            <CommandList
                                ref={listRef}
                                label={label}
                                className="outline-none"
                            >
                                {options.map((option) => {
                                    const checked = value.includes(
                                        option.value,
                                    );

                                    return (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            aria-checked={checked}
                                            onSelect={() =>
                                                toggle(option.value)
                                            }
                                            className={cn(isStacked && 'h-11')}
                                        >
                                            <span
                                                aria-hidden
                                                data-state={
                                                    checked
                                                        ? 'checked'
                                                        : 'unchecked'
                                                }
                                                className="flex size-4 shrink-0 items-center justify-center rounded-xs border border-input bg-card text-primary-foreground shadow-xs data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                                            >
                                                {checked && (
                                                    <Check className="size-3.5" />
                                                )}
                                            </span>
                                            {option.mark}
                                            <span className="truncate">
                                                {option.label}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}
        </FacetFrame>
    );
}

/** The facets after Assignee, in the order of the mockup. */
export function ActionItemExtraFacets({
    filters,
    onChange,
    stacked,
}: {
    filters: ActionItemFilters;
    onChange: (changes: ActionItemFilterChanges) => void;
    stacked?: boolean;
}) {
    const { t } = useTrans();
    const priorities: FacetOption<ActionItemPriority>[] = (
        [
            ['high', t('High')],
            ['medium', t('Medium')],
            ['low', t('Low')],
        ] as const
    ).map(([priority, label]) => ({
        value: priority,
        label,
        mark: <ActionPriorityMark priority={priority} label="" />,
    }));

    return (
        <>
            <MultiFacet
                label={t('Priority')}
                icon={SignalHigh}
                options={priorities}
                value={filters.priority}
                allValue={[]}
                stacked={stacked}
                clearLabel={t('Clear priority')}
                onChange={(priority) => onChange({ priority })}
                onClear={() => onChange({ priority: [] })}
            />
            <SingleFacet
                label={t('Due date')}
                icon={Calendar}
                value={filters.due ?? Any}
                active={filters.due !== null}
                stacked={stacked}
                clearLabel={t('Clear due date')}
                onValueChange={(due) =>
                    onChange({
                        due:
                            DueBuckets.find((bucket) => bucket === due) ?? null,
                    })
                }
                onClear={() => onChange({ due: null })}
            >
                <SelectItem value={Any}>{t('Any')}</SelectItem>
                <SelectItem value="overdue">{t('Overdue')}</SelectItem>
                <SelectItem value="today">{t('Today')}</SelectItem>
                <SelectItem value="week">{t('Next 7 days')}</SelectItem>
                <SelectItem value="later">{t('Later')}</SelectItem>
                <SelectItem value="none">{t('No due date')}</SelectItem>
            </SingleFacet>
            <SingleFacet
                label={t('Source')}
                icon={StickyNote}
                value={filters.source ?? Any}
                active={filters.source !== null}
                stacked={stacked}
                clearLabel={t('Clear source')}
                onValueChange={(source) =>
                    onChange({
                        source: Sources.find((each) => each === source) ?? null,
                    })
                }
                onClear={() => onChange({ source: null })}
            >
                <SelectItem value={Any}>{t('Any')}</SelectItem>
                <SelectItem value="retro">{t('From a retro')}</SelectItem>
                <SelectItem value="outside">
                    {t('Added outside a retro')}
                </SelectItem>
            </SingleFacet>
        </>
    );
}
