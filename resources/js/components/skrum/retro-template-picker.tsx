import {
    ArrowRight,
    Building2,
    CircleCheck,
    Copy,
    History,
    Pencil,
    Plus,
    Search,
    SearchX,
    Star,
    Timer,
    VenetianMask,
    Vote,
    X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { EmptyState } from '@/components/skrum/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

/** The server's empty board (`TemplateCatalogue::Custom`). */
export const BlankTemplateId = 'custom';

export type TemplateColumnColor = ColumnColor;
export type TemplateSource = 'builtin' | 'workspace' | 'recent';

export type RetroTemplateColumn = {
    id?: string;
    title: string;
    color: TemplateColumnColor;
    description?: string | null;
};

export type RetroTemplate = {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    source: TemplateSource;
    columns: RetroTemplateColumn[];
    defaults?: {
        votesPerPerson?: number | null;
        maxPerCard?: number | null;
        anonymous?: boolean;
        timers?: Partial<Record<'writing' | 'voting' | 'discussing', number>>;
    };
    isTeamDefault?: boolean;
    usageCount?: number;
    workspaceName?: string;
    /** Who made a workspace template; shown in the detail. */
    author?: string;
};

export type RetroTemplateCategory = { value: string; label: string };

export type RetroTemplatePickerProps = {
    value: string;
    onValueChange: (id: string) => void;
    templates: RetroTemplate[];
    /** Id sent for "Start from scratch". A template with this id is not listed twice. */
    blankId?: string;
    name?: string;
    tab?: TemplateSource;
    onTabChange?: (tab: TemplateSource) => void;
    query?: string;
    onQueryChange?: (query: string) => void;
    categories?: RetroTemplateCategory[];
    category?: string;
    onCategoryChange?: (category: string) => void;
    loading?: boolean;
    onUse?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    /** Offered on a workspace template only. */
    onEdit?: (id: string) => void;
    /** Why "Use this template" cannot be used now: the button stays in place, inert, with this sentence. */
    useDisabledReason?: string;
    onCreate?: () => void;
    /** `/` focuses the search. Off when the host owns that key. */
    shortcuts?: boolean;
    className?: string;
};

const colorContext: Record<ColumnColor, string> = {
    sun: 'col-sun',
    apricot: 'col-apricot',
    coral: 'col-coral',
    plum: 'col-plum',
    iris: 'col-iris',
    sky: 'col-sky',
    lagoon: 'col-lagoon',
    moss: 'col-moss',
};

export function columnColorClass(color: string): string {
    return colorContext[color as ColumnColor] ?? 'col-iris';
}

const SearchDebounceMs = 300;
const SkeletonCardCount = 6;
const AllCategories = 'all';

function normalize(text: string): string {
    return text.trim().toLocaleLowerCase();
}

function matchesQuery(
    template: RetroTemplate,
    needle: string,
    categoryLabel: string,
): boolean {
    if (needle === '') {
        return true;
    }

    return [
        template.name,
        template.description ?? '',
        categoryLabel,
        ...template.columns.map((column) => column.title),
    ].some((text) => text.toLocaleLowerCase().includes(needle));
}

function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handle = window.setTimeout(() => setDebounced(value), delay);

        return () => window.clearTimeout(handle);
    }, [value, delay]);

    return debounced;
}

function useControllable<T>(
    controlled: T | undefined,
    initial: T,
    onChange?: (value: T) => void,
): [T, (value: T) => void] {
    const [internal, setInternal] = useState(initial);
    const current = controlled ?? internal;

    function update(next: T): void {
        setInternal(next);
        onChange?.(next);
    }

    return [current, update];
}

function ColumnStrip({ columns }: { columns: RetroTemplateColumn[] }) {
    return (
        <span
            aria-hidden
            data-slot="template-strip"
            className="flex h-1.5 w-full gap-0.5"
        >
            {columns.map((column, index) => (
                <span
                    key={column.id ?? index}
                    className={cn(
                        'min-w-0 flex-1 rounded-full bg-(--col-border)',
                        columnColorClass(column.color),
                    )}
                />
            ))}
        </span>
    );
}

function TemplateBadges({
    template,
    className,
}: {
    template: RetroTemplate;
    className?: string;
}) {
    const { t } = useTrans();
    const showUsage =
        template.usageCount !== undefined && template.usageCount > 0;
    const hasBadge =
        template.isTeamDefault === true ||
        showUsage ||
        template.workspaceName !== undefined;

    if (!hasBadge) {
        return null;
    }

    return (
        <span
            data-slot="template-badges"
            className={cn('flex min-w-0 flex-wrap gap-1', className)}
        >
            {template.isTeamDefault && (
                <Badge variant="soft" icon={Star} className="max-w-full">
                    <span className="truncate">{t('Default')}</span>
                </Badge>
            )}
            {showUsage && (
                <Badge variant="muted" icon={History} className="max-w-full">
                    <span className="truncate">
                        {t('Used :count times', {
                            count: template.usageCount ?? 0,
                        })}
                    </span>
                </Badge>
            )}
            {template.workspaceName !== undefined && (
                <Badge variant="info" icon={Building2} className="max-w-full">
                    <span className="truncate">{template.workspaceName}</span>
                </Badge>
            )}
        </span>
    );
}

const cardClasses = cn(
    'group/template @container/card relative flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border border-input bg-card px-3 pt-2 pb-3 text-left shadow-card transition-[background-color,border-color,box-shadow] duration-140 ease-standard outline-none @xs/card:px-4',
    'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
    'aria-checked:border-primary aria-checked:bg-skrum-primary-soft aria-checked:ring-1 aria-checked:ring-primary aria-checked:ring-inset',
);

function CheckMark() {
    return (
        <CircleCheck
            aria-hidden
            className="absolute top-2 right-2 size-4 text-primary opacity-0 group-aria-checked/template:opacity-100"
        />
    );
}

function TemplateCard({
    template,
    selected,
    focusable,
    onSelect,
}: {
    template: RetroTemplate;
    selected: boolean;
    focusable: boolean;
    onSelect: () => void;
}) {
    const { t } = useTrans();
    const id = useId();
    const nameId = `${id}-name`;
    const metaId = `${id}-meta`;

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={nameId}
            aria-describedby={metaId}
            tabIndex={focusable ? 0 : -1}
            data-slot="template-card"
            data-template-id={template.id}
            onClick={onSelect}
            className={cardClasses}
        >
            <ColumnStrip columns={template.columns} />
            <span
                id={nameId}
                className="block truncate pr-5 text-sm font-semibold font-title"
            >
                {template.name}
            </span>
            <span id={metaId} className="flex min-w-0 flex-col gap-1.5">
                <span className="block truncate text-xs text-muted-foreground">
                    {t(':count columns', { count: template.columns.length })}
                </span>
                {template.description ? (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                        {template.description}
                    </span>
                ) : null}
            </span>
            <TemplateBadges template={template} />
            <CheckMark />
        </button>
    );
}

function BlankCard({
    blankId,
    selected,
    focusable,
    onSelect,
}: {
    blankId: string;
    selected: boolean;
    focusable: boolean;
    onSelect: () => void;
}) {
    const { t } = useTrans();
    const id = useId();

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={`${id}-name`}
            aria-describedby={`${id}-meta`}
            tabIndex={focusable ? 0 : -1}
            data-slot="template-card"
            data-template-id={blankId}
            onClick={onSelect}
            className={cn(cardClasses, 'border-dashed bg-transparent')}
        >
            <span className="flex h-1.5 w-full items-center">
                <Plus aria-hidden className="size-3.5 text-muted-foreground" />
            </span>
            <span
                id={`${id}-name`}
                className="block truncate pr-5 text-sm font-semibold font-title"
            >
                {t('Start from scratch')}
            </span>
            <span
                id={`${id}-meta`}
                className="line-clamp-2 text-xs text-muted-foreground"
            >
                {t('An empty board: add your own columns.')}
            </span>
            <CheckMark />
        </button>
    );
}

function formatMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
}

function DetailSettings({ defaults }: { defaults: RetroTemplate['defaults'] }) {
    const { t } = useTrans();

    if (defaults === undefined) {
        return null;
    }

    const timers = defaults.timers ?? {};
    const timerLabels: Array<
        [keyof typeof timers, (minutes: number) => string]
    > = [
        ['writing', (minutes) => t('Writing :minutes min', { minutes })],
        ['voting', (minutes) => t('Voting :minutes min', { minutes })],
        ['discussing', (minutes) => t('Discussion :minutes min', { minutes })],
    ];
    const items: Array<{ key: string; icon: typeof Vote; label: string }> = [];

    if (defaults.votesPerPerson != null) {
        items.push({
            key: 'votes',
            icon: Vote,
            label: t(':count votes per person', {
                count: defaults.votesPerPerson,
            }),
        });
    }

    if (defaults.maxPerCard != null) {
        items.push({
            key: 'max',
            icon: Vote,
            label: t('Max :count per card', { count: defaults.maxPerCard }),
        });
    }

    if (defaults.anonymous !== undefined) {
        items.push({
            key: 'anonymous',
            icon: VenetianMask,
            label: defaults.anonymous ? t('Anonymous') : t('Named cards'),
        });
    }

    for (const [timer, label] of timerLabels) {
        const seconds = timers[timer];

        if (seconds !== undefined) {
            items.push({
                key: timer,
                icon: Timer,
                label: label(formatMinutes(seconds)),
            });
        }
    }

    if (items.length === 0) {
        return null;
    }

    return (
        <ul
            data-slot="template-settings"
            className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        >
            {items.map(({ key, icon: Icon, label }) => (
                <li key={key} className="flex min-w-0 items-center gap-1.5">
                    <Icon aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                </li>
            ))}
        </ul>
    );
}

function MiniBoard({ columns }: { columns: RetroTemplateColumn[] }) {
    return (
        <ul
            data-slot="template-mini-board"
            className="grid auto-cols-fr grid-flow-col gap-2 rounded-lg border bg-skrum-canvas p-2 @max-md/detail:grid-flow-row @max-md/detail:grid-cols-2"
        >
            {columns.map((column, index) => (
                <li
                    key={column.id ?? index}
                    className={cn(
                        'flex min-w-0 flex-col gap-1.5 rounded-md border border-(--col-border) bg-(--col) p-2',
                        columnColorClass(column.color),
                    )}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full bg-(--col-border)"
                        />
                        <span className="truncate text-xs font-semibold text-(--col-text)">
                            {column.title}
                        </span>
                    </span>
                    {column.description ? (
                        <span className="line-clamp-3 text-xs text-muted-foreground">
                            {column.description}
                        </span>
                    ) : null}
                    <span
                        aria-hidden
                        className="h-4 rounded-sm bg-card/70 shadow-card"
                    />
                    <span
                        aria-hidden
                        className="h-4 w-2/3 rounded-sm bg-card/70 shadow-card"
                    />
                </li>
            ))}
        </ul>
    );
}

function DetailPanel({
    template,
    blank,
    blankId,
    onUse,
    onDuplicate,
    onEdit,
    useDisabledReason,
    categoryLabel,
}: {
    template: RetroTemplate | undefined;
    blank: boolean;
    blankId: string;
    onUse?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onEdit?: (id: string) => void;
    useDisabledReason?: string;
    categoryLabel?: string;
}) {
    const { t } = useTrans();
    const reasonId = useId();

    if (template === undefined && !blank) {
        return null;
    }

    const id = template?.id ?? blankId;
    const canEdit = onEdit !== undefined && template?.source === 'workspace';
    const name = template?.name ?? t('Start from scratch');
    const description =
        template === undefined
            ? t('An empty board: add your own columns.')
            : template.description;

    return (
        <section
            data-slot="template-detail"
            aria-label={t('Template preview')}
            className="@container/detail flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/55 p-4"
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <h3
                    aria-live="polite"
                    className="text-base font-semibold font-title break-words"
                >
                    {name}
                </h3>
                {template !== undefined && (
                    <span className="flex min-w-0 flex-wrap gap-1">
                        {categoryLabel !== undefined && (
                            <Badge variant="outline" className="max-w-full">
                                <span className="truncate">
                                    {categoryLabel}
                                </span>
                            </Badge>
                        )}
                        <TemplateBadges template={template} />
                    </span>
                )}
            </div>
            {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
            {template?.author !== undefined && (
                <p
                    data-slot="template-author"
                    className="text-xs wrap-anywhere text-muted-foreground"
                >
                    {t('By :name', { name: template.author })}
                </p>
            )}
            {template !== undefined && template.columns.length > 0 && (
                <MiniBoard columns={template.columns} />
            )}
            {template !== undefined && (
                <DetailSettings defaults={template.defaults} />
            )}
            {(onUse !== undefined ||
                (onDuplicate !== undefined && template !== undefined) ||
                canEdit) && (
                <div className="flex min-w-0 flex-wrap gap-2">
                    {onUse !== undefined && (
                        <Button
                            type="button"
                            className="max-w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                            aria-disabled={
                                useDisabledReason === undefined
                                    ? undefined
                                    : true
                            }
                            aria-describedby={
                                useDisabledReason === undefined
                                    ? undefined
                                    : reasonId
                            }
                            onClick={() => {
                                if (useDisabledReason === undefined) {
                                    onUse(id);
                                }
                            }}
                        >
                            <span className="truncate">
                                {t('Use this template')}
                            </span>
                            <ArrowRight aria-hidden />
                        </Button>
                    )}
                    {onDuplicate !== undefined && template !== undefined && (
                        <Button
                            type="button"
                            variant="outline"
                            className="max-w-full"
                            onClick={() => onDuplicate(template.id)}
                        >
                            <Copy aria-hidden />
                            <span className="truncate">
                                {t('Duplicate and edit')}
                            </span>
                        </Button>
                    )}
                    {canEdit && (
                        <Button
                            type="button"
                            variant="outline"
                            className="max-w-full"
                            onClick={() => onEdit?.(id)}
                        >
                            <Pencil aria-hidden />
                            <span className="truncate">{t('Edit')}</span>
                        </Button>
                    )}
                    {onUse !== undefined && useDisabledReason !== undefined && (
                        <p
                            id={reasonId}
                            data-slot="template-use-reason"
                            className="basis-full text-xs text-muted-foreground"
                        >
                            {useDisabledReason}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

function LoadingState() {
    const { t } = useTrans();

    return (
        <div
            data-slot="template-loading"
            aria-busy="true"
            className="grid gap-4 @3xl/picker:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
            <span className="sr-only" role="status">
                {t('Loading templates…')}
            </span>
            <div
                aria-hidden
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(44)),1fr))] gap-2"
            >
                {Array.from({ length: SkeletonCardCount }, (_, index) => (
                    <div
                        key={index}
                        className="flex flex-col gap-2 rounded-lg border bg-card px-3 pt-2 pb-3"
                    >
                        <Skeleton className="h-1.5 w-full rounded-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                    </div>
                ))}
            </div>
            <Skeleton aria-hidden className="h-48 rounded-lg" />
        </div>
    );
}

export function RetroTemplatePicker({
    value,
    onValueChange,
    templates: allTemplates,
    blankId = BlankTemplateId,
    name,
    tab: controlledTab,
    onTabChange,
    query: controlledQuery,
    onQueryChange,
    categories,
    category: controlledCategory,
    onCategoryChange,
    loading = false,
    onUse,
    onDuplicate,
    onEdit,
    useDisabledReason,
    onCreate,
    shortcuts = true,
    className,
}: RetroTemplatePickerProps) {
    const { t } = useTrans();
    const [tab, setTab] = useControllable<TemplateSource>(
        controlledTab,
        'builtin',
        onTabChange,
    );
    const [query, setQuery] = useControllable(
        controlledQuery,
        '',
        onQueryChange,
    );
    const [category, setCategory] = useControllable(
        controlledCategory,
        AllCategories,
        onCategoryChange,
    );
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const templates = allTemplates.filter(
        (template) => template.id !== blankId,
    );
    const groupRef = useRef<HTMLDivElement>(null);

    const needle = normalize(query);
    const categoryLabelOf = (key: string | null | undefined): string =>
        categories?.find((option) => option.value === key)?.label ?? '';
    const inTab = templates.filter((template) => template.source === tab);
    const visible = inTab.filter(
        (template) =>
            (category === AllCategories || template.category === category) &&
            matchesQuery(template, needle, categoryLabelOf(template.category)),
    );
    const count = (source: TemplateSource): number =>
        templates.filter((template) => template.source === source).length;
    const tabs: TemplateSource[] = [
        'builtin',
        'workspace',
        ...(count('recent') > 0 ? (['recent'] as const) : []),
    ];
    const tabLabel: Record<TemplateSource, string> = {
        builtin: t('Built-in'),
        workspace: t('My workspace'),
        recent: t('Recent'),
    };
    const selectedTemplate = templates.find(
        (template) => template.id === value,
    );
    const isBlank = value === blankId;
    const rovingId = visible.some((template) => template.id === value)
        ? value
        : isBlank
          ? blankId
          : (visible[0]?.id ?? blankId);
    const announcedCount = useDebounced(visible.length, SearchDebounceMs);
    const hasResults = visible.length > 0;
    const isFiltering = needle !== '' || category !== AllCategories;

    useShortcut('/', () => searchRef.current?.focus(), {
        enabled: shortcuts,
        scope: rootRef,
    });

    /**
     * Radix closes a dialog from a capture listener on `document`, before
     * React sees the key. Escape that clears the search is taken on `window`,
     * one step earlier, so a host dialog stays open.
     */
    useEffect(() => {
        if (query === '') {
            return;
        }

        function clearOnEscape(event: globalThis.KeyboardEvent): void {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return;
            }

            if (event.target !== searchRef.current) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            setQuery('');
        }

        window.addEventListener('keydown', clearOnEscape, true);

        return () => window.removeEventListener('keydown', clearOnEscape, true);
    }, [query]);

    function clearQuery(): void {
        setQuery('');
        searchRef.current?.focus();
    }

    function handleGroupKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        const items = Array.from(
            groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ??
                [],
        );
        const current = items.indexOf(event.target as HTMLElement);

        if (current === -1) {
            return;
        }

        if (event.key === 'Enter') {
            if (onUse === undefined || useDisabledReason !== undefined) {
                return;
            }

            event.preventDefault();
            onUse(items[current].dataset.templateId ?? blankId);

            return;
        }

        const firstTop = items[0].offsetTop;
        const perRow = Math.max(
            1,
            items.filter((item) => item.offsetTop === firstTop).length,
        );
        const lastRow = Math.floor((items.length - 1) / perRow);
        let next = current;

        if (event.key === 'ArrowRight') {
            next = Math.min(current + 1, items.length - 1);
        } else if (event.key === 'ArrowLeft') {
            next = Math.max(current - 1, 0);
        } else if (event.key === 'ArrowDown') {
            next =
                current + perRow < items.length
                    ? current + perRow
                    : Math.floor(current / perRow) < lastRow
                      ? items.length - 1
                      : current;
        } else if (event.key === 'ArrowUp') {
            next = current - perRow >= 0 ? current - perRow : current;
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = items.length - 1;
        } else {
            return;
        }

        event.preventDefault();
        items[next].focus();
        onValueChange(items[next].dataset.templateId ?? blankId);
    }

    const emptyState = (() => {
        if (!isFiltering && inTab.length > 0) {
            return null;
        }

        const blankAction = {
            label: t('Start from scratch'),
            onClick: () => onValueChange(blankId),
        };

        if (isFiltering) {
            return (
                <EmptyState
                    module="retro"
                    illustration={false}
                    headingLevel="h3"
                    title={t('No template matches ":query"', {
                        query: query.trim() === '' ? tabLabel[tab] : query,
                    })}
                    description={t('Try another word or start from scratch.')}
                    action={{
                        label: t('Clear search'),
                        icon: SearchX,
                        variant: 'outline',
                        onClick: () => {
                            setQuery('');
                            setCategory(AllCategories);
                        },
                    }}
                    secondaryAction={blankAction}
                />
            );
        }

        return (
            <EmptyState
                module="retro"
                illustration={false}
                headingLevel="h3"
                title={
                    tab === 'workspace'
                        ? t('No workspace template yet.')
                        : t('No template available.')
                }
                description={t('You can always start from scratch.')}
                action={
                    tab === 'workspace' && onCreate !== undefined
                        ? {
                              label: t('Create a template'),
                              icon: Plus,
                              onClick: onCreate,
                          }
                        : undefined
                }
                secondaryAction={blankAction}
            />
        );
    })();

    return (
        <div
            ref={rootRef}
            data-slot="retro-template-picker"
            className={cn('@container/picker flex min-w-0 flex-col', className)}
        >
            {name !== undefined && (
                <input type="hidden" name={name} value={value} />
            )}
            <Tabs
                value={tab}
                onValueChange={(next) => setTab(next as TemplateSource)}
            >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <TabsList>
                        {tabs.map((source) => (
                            <TabsTrigger
                                key={source}
                                value={source}
                                count={count(source)}
                            >
                                {tabLabel[source]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="relative min-w-0 grow basis-48 @3xl/picker:max-w-72">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            ref={searchRef}
                            type="search"
                            value={query}
                            placeholder={t('Search templates')}
                            aria-label={t('Search templates')}
                            aria-keyshortcuts="/"
                            className="px-8 [&::-webkit-search-cancel-button]:hidden"
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                }
                            }}
                        />
                        {query !== '' && (
                            <button
                                type="button"
                                aria-label={t('Clear')}
                                onClick={clearQuery}
                                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X aria-hidden className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                {categories !== undefined && categories.length > 0 && (
                    <div
                        role="group"
                        aria-label={t('Category')}
                        className="flex flex-wrap gap-1"
                    >
                        {[
                            { value: AllCategories, label: t('All') },
                            ...categories,
                        ].map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={
                                    category === option.value
                                        ? 'secondary'
                                        : 'ghost'
                                }
                                aria-pressed={category === option.value}
                                className="max-w-full"
                                onClick={() => setCategory(option.value)}
                            >
                                <span className="truncate">{option.label}</span>
                            </Button>
                        ))}
                    </div>
                )}
                <span role="status" className="sr-only">
                    {loading
                        ? ''
                        : t(':count templates found', {
                              count: announcedCount,
                          })}
                </span>
                <TabsContent value={tab} className="min-w-0">
                    {loading ? (
                        <LoadingState />
                    ) : (
                        <div className="grid gap-4 @3xl/picker:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                            <div className="min-w-0">
                                {hasResults ? (
                                    <div
                                        ref={groupRef}
                                        role="radiogroup"
                                        aria-label={t('Retrospective template')}
                                        onKeyDown={handleGroupKeyDown}
                                        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(44)),1fr))] gap-2"
                                    >
                                        {visible.map((template) => (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                selected={template.id === value}
                                                focusable={
                                                    template.id === rovingId
                                                }
                                                onSelect={() =>
                                                    onValueChange(template.id)
                                                }
                                            />
                                        ))}
                                        <BlankCard
                                            blankId={blankId}
                                            selected={isBlank}
                                            focusable={rovingId === blankId}
                                            onSelect={() =>
                                                onValueChange(blankId)
                                            }
                                        />
                                    </div>
                                ) : (
                                    emptyState
                                )}
                            </div>
                            <DetailPanel
                                template={selectedTemplate}
                                blank={isBlank}
                                blankId={blankId}
                                onUse={onUse}
                                onDuplicate={onDuplicate}
                                onEdit={onEdit}
                                useDisabledReason={useDisabledReason}
                                categoryLabel={
                                    categoryLabelOf(
                                        selectedTemplate?.category,
                                    ) || undefined
                                }
                            />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
