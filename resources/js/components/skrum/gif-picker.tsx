import {
    ArrowLeft,
    Ban,
    Bell,
    Check,
    Film,
    KeyRound,
    Pause,
    Play,
    RefreshCw,
    Search,
    SearchX,
    Send,
    ShieldCheck,
    Timer,
    TrendingUp,
    WifiOff,
    X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, UIEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type GifRating = 'g' | 'pg';
export type GifProvider = 'giphy' | 'tenor';
export type GifPickerStatus =
    | 'idle'
    | 'loading'
    | 'empty'
    | 'error'
    | 'rate_limited'
    | 'disabled';

/**
 * `id`, `previewUrl`, `width` and `height` are what the GIF proxy returns
 * (`GameGifSearchResult`). The other fields are richer provider data the
 * server does not send today; nothing is rendered for an absent one.
 */
export type GifItem = {
    id: string;
    previewUrl: string;
    width: number;
    height: number;
    title?: string;
    durationMs?: number;
    mp4?: string;
    webp?: string;
    still?: string;
};

export type GifCategory = { key: string; label: string; query: string };

export type GifPickerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    results?: GifItem[];
    provider?: GifProvider;
    categories?: GifCategory[];
    suggestions?: string[];
    initialQuery?: string;
    rating?: GifRating;
    lang?: string;
    selectedId?: string;
    withCaption?: boolean;
    captionMaxLength?: number;
    reducedMotion?: boolean;
    status?: GifPickerStatus;
    onSelect: (gif: GifItem, caption?: string) => void;
    onQueryChange?: (query: string) => void;
    onRetry?: () => void;
    onLoadMore?: () => void;
    onNotifyAdmin?: () => void;
    className?: string;
};

const providerNames: Record<GifProvider, string> = {
    giphy: 'GIPHY',
    tenor: 'Tenor',
};

const placeholderColors = [
    'col-apricot',
    'col-sky',
    'col-moss',
    'col-plum',
    'col-sun',
    'col-lagoon',
    'col-coral',
    'col-iris',
];

const skeletonColumns = [
    ['h-30', 'h-25', 'h-22'],
    ['h-21', 'h-32', 'h-27'],
];

const loadMoreThreshold = 48;

export function formatGifDuration(durationMs: number, lang: string): string {
    const seconds = new Intl.NumberFormat(lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(durationMs / 1000);

    return `${seconds} s`;
}

export function splitIntoColumns(gifs: GifItem[]): [GifItem[], GifItem[]] {
    const columns: [GifItem[], GifItem[]] = [[], []];
    const heights = [0, 0];

    gifs.forEach((gif) => {
        const target = heights[1] < heights[0] ? 1 : 0;
        columns[target].push(gif);
        heights[target] += gif.width > 0 ? gif.height / gif.width : 1;
    });

    return columns;
}

function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function colorFor(id: string): string {
    const sum = Array.from(id).reduce(
        (total, character) => total + character.charCodeAt(0),
        0,
    );

    return placeholderColors[sum % placeholderColors.length];
}

function GifMedia({
    gif,
    label,
    playing,
}: {
    gif: GifItem;
    label: string;
    playing: boolean;
}) {
    if (playing && gif.mp4) {
        return (
            <video
                aria-label={label}
                autoPlay
                muted
                loop
                playsInline
                poster={gif.still || undefined}
                src={gif.mp4}
                className="absolute inset-0 size-full object-cover"
            />
        );
    }

    const image = playing ? gif.webp || gif.previewUrl || gif.still : gif.still;

    if (image) {
        return (
            <img
                alt={label}
                src={image}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
            />
        );
    }

    return (
        <span
            data-slot="gif-placeholder"
            aria-hidden="true"
            className={cn(
                colorFor(gif.id),
                'absolute inset-0 grid place-items-center bg-(--col) text-(--col-text)',
            )}
        >
            <Film className={cn('size-6', !playing && 'opacity-35')} />
        </span>
    );
}

function StateBlock({
    icon: Icon,
    title,
    description,
    destructive = false,
    children,
}: {
    icon: typeof Search;
    title: string;
    description: string;
    destructive?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            <span
                className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-xl',
                    destructive
                        ? 'bg-skrum-destructive-soft text-skrum-destructive-text'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                <Icon aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-semibold">{title}</p>
            <p className="max-w-72 text-sm text-muted-foreground">
                {description}
            </p>
            {children}
        </div>
    );
}

function GifPickerPanel({
    onOpenChange,
    results = [],
    provider = 'giphy',
    categories,
    suggestions,
    initialQuery = '',
    rating = 'g',
    lang,
    selectedId,
    withCaption = false,
    captionMaxLength = 60,
    reducedMotion,
    status = 'idle',
    onSelect,
    onQueryChange,
    onRetry,
    onLoadMore,
    onNotifyAdmin,
    className,
}: Omit<GifPickerProps, 'open'>) {
    const { t } = useTrans();
    const bodyId = useId();
    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [query, setQuery] = useState(initialQuery);
    const [previewed, setPreviewed] = useState<GifItem | null>(null);
    const [caption, setCaption] = useState('');
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [toggledId, setToggledId] = useState<string | null>(null);
    const [opener] = useState<Element | null>(() =>
        typeof document === 'undefined' ? null : document.activeElement,
    );
    const backToId = useRef<string | null>(null);

    const isDisabled = status === 'disabled';
    const isReduced = reducedMotion ?? prefersReducedMotion();
    const locale =
        lang ??
        (typeof document !== 'undefined' && document.documentElement.lang
            ? document.documentElement.lang
            : 'en');
    const providerName = providerNames[provider];
    const trimmedQuery = query.trim();

    const tabs = useMemo<GifCategory[]>(
        () =>
            categories ?? [
                { key: 'trending', label: t('Trending'), query: '' },
                ...[
                    { key: 'celebrate', label: t('Celebrate') },
                    { key: 'tired', label: t('Tired') },
                    { key: 'facepalm', label: t('Facepalm') },
                    { key: 'coffee', label: t('Coffee') },
                    { key: 'deadline', label: t('Deadline') },
                ].map(({ key, label }) => ({
                    key,
                    label,
                    query: label.toLowerCase(),
                })),
            ],
        [categories, t],
    );
    const activeTab = tabs.find((tab) => tab.query === trimmedQuery);
    const columns = useMemo(() => splitIntoColumns(results), [results]);
    const suggestionList = suggestions ?? [
        t('sprint'),
        t('victory'),
        t('tired'),
    ];

    useEffect(() => {
        if (!isDisabled) {
            searchRef.current?.focus();
        }
    }, [isDisabled]);

    useEffect(() => {
        return () => {
            const active = document.activeElement;

            if (
                (active === null || active === document.body) &&
                opener instanceof HTMLElement &&
                opener.isConnected
            ) {
                opener.focus();
            }
        };
    }, [opener]);

    const isPreviewing = previewed !== null;

    useEffect(() => {
        if (isPreviewing || backToId.current === null) {
            return;
        }

        const tile = tileRefs.current[backToId.current];
        backToId.current = null;

        if (tile) {
            tile.focus();

            return;
        }

        searchRef.current?.focus();
    }, [isPreviewing]);

    const changeQuery = (next: string): void => {
        setQuery(next);
        onQueryChange?.(next);
    };

    const titleFor = (gif: GifItem): string => {
        if (gif.title) {
            return gif.title;
        }

        const index = results.findIndex((item) => item.id === gif.id);

        return index === -1 ? t('GIF') : t('GIF :index', { index: index + 1 });
    };

    const durationFor = (gif: GifItem): string | null =>
        gif.durationMs === undefined
            ? null
            : formatGifDuration(gif.durationMs, locale);

    const labelFor = (gif: GifItem): string => {
        const duration = durationFor(gif);

        return duration === null
            ? titleFor(gif)
            : `${titleFor(gif)} · ${duration}`;
    };

    const isPlaying = (gif: GifItem): boolean => {
        if (isReduced) {
            return (
                toggledId === gif.id ||
                hoveredId === gif.id ||
                focusedId === gif.id
            );
        }

        return toggledId !== gif.id;
    };

    const choose = (gif: GifItem): void => {
        if (!withCaption) {
            onSelect(gif);

            return;
        }

        setCaption('');
        setPreviewed(gif);
    };

    const focusTile = (gif: GifItem | undefined): void => {
        if (gif) {
            tileRefs.current[gif.id]?.focus();
        }
    };

    const onTileKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        gif: GifItem,
        columnIndex: number,
        rowIndex: number,
    ): void => {
        const column = columns[columnIndex];
        const other = columns[columnIndex === 0 ? 1 : 0];
        const moves: Record<string, GifItem | undefined> = {
            ArrowDown: column[rowIndex + 1],
            ArrowUp: column[rowIndex - 1],
            ArrowRight:
                columnIndex === 0
                    ? other[Math.min(rowIndex, other.length - 1)]
                    : undefined,
            ArrowLeft:
                columnIndex === 1
                    ? other[Math.min(rowIndex, other.length - 1)]
                    : undefined,
            Home: results[0],
            End: results[results.length - 1],
        };

        if (event.key in moves) {
            event.preventDefault();
            focusTile(moves[event.key]);

            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            choose(gif);

            return;
        }

        if (event.key === ' ') {
            event.preventDefault();
            setToggledId((current) => (current === gif.id ? null : gif.id));
        }
    };

    const onTabKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void => {
        const offsets: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
        };

        if (!(event.key in offsets)) {
            return;
        }

        event.preventDefault();
        const next =
            tabs[(index + offsets[event.key] + tabs.length) % tabs.length];
        tabRefs.current[next.key]?.focus();
        changeQuery(next.query);
    };

    const onBodyScroll = (event: UIEvent<HTMLDivElement>): void => {
        if (!onLoadMore || status !== 'idle') {
            return;
        }

        const body = event.currentTarget;

        if (
            body.scrollTop + body.clientHeight >=
            body.scrollHeight - loadMoreThreshold
        ) {
            onLoadMore();
        }
    };

    const rovingId =
        focusedId ??
        (results.some((gif) => gif.id === selectedId)
            ? selectedId
            : undefined) ??
        results[0]?.id;

    const announcement =
        status !== 'idle' || results.length === 0
            ? ''
            : trimmedQuery === ''
              ? t(':count trending GIFs', { count: results.length })
              : t(':count GIFs for “:query”', {
                    count: results.length,
                    query: trimmedQuery,
                });

    const footer = (
        <div className="flex min-w-0 items-center justify-between gap-2 border-t px-3 py-2 text-overline font-normal tracking-normal text-muted-foreground normal-case">
            {isDisabled ? (
                <span className="flex min-w-0 items-center gap-1">
                    <Ban aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate">
                        {t(':provider integration disabled', {
                            provider: providerName,
                        })}
                    </span>
                </span>
            ) : (
                <>
                    <span className="flex min-w-0 items-center gap-1">
                        <ShieldCheck
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                        />
                        <span className="truncate">
                            {rating === 'pg' ? t('Rated PG') : t('Rated G')}
                        </span>
                    </span>
                    <span
                        data-slot="gif-attribution"
                        className="shrink-0 font-extrabold tracking-overline text-foreground uppercase"
                    >
                        Powered by {providerName}
                    </span>
                </>
            )}
        </div>
    );

    const root = cn(
        'flex w-full max-w-104 min-w-0 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-popover',
        className,
    );

    const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onOpenChange(false);
        }
    };

    if (previewed) {
        const remaining = captionMaxLength - caption.length;
        const previewDuration = durationFor(previewed);

        return (
            <div
                role="dialog"
                aria-label={t('Choose a GIF')}
                data-slot="gif-picker"
                data-view="preview"
                className={root}
                onKeyDown={onRootKeyDown}
            >
                <div className="flex flex-col gap-3 p-3">
                    <div className="relative h-42 w-full overflow-hidden rounded-md bg-muted">
                        <GifMedia
                            gif={previewed}
                            label={labelFor(previewed)}
                            playing={!isReduced}
                        />
                        {previewDuration !== null && (
                            <span className="absolute right-1.5 bottom-1.5 rounded-full bg-foreground/80 px-1.5 font-mono text-overline font-semibold tracking-normal text-background">
                                {previewDuration}
                            </span>
                        )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold">
                            {titleFor(previewed)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {previewDuration !== null && (
                                <>
                                    {previewDuration}
                                    {' · '}
                                </>
                            )}
                            {t('looping')}
                            {' · '}
                            {t('shared with the room')}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Input
                            autoFocus
                            value={caption}
                            maxLength={captionMaxLength}
                            aria-label={t('Caption')}
                            placeholder={t('Add a caption (optional)')}
                            onChange={(event) =>
                                setCaption(
                                    event.target.value.slice(
                                        0,
                                        captionMaxLength,
                                    ),
                                )
                            }
                        />
                        <span
                            data-slot="gif-caption-count"
                            className={cn(
                                'self-end font-mono text-xs text-muted-foreground',
                                remaining === 0 && 'text-foreground',
                            )}
                        >
                            {caption.length}/{captionMaxLength}
                        </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="max-w-full"
                            onClick={() => {
                                backToId.current = previewed.id;
                                setPreviewed(null);
                            }}
                        >
                            <ArrowLeft aria-hidden="true" />
                            <span className="truncate">{t('Back')}</span>
                        </Button>
                        <Button
                            size="sm"
                            className="max-w-full"
                            onClick={() =>
                                onSelect(
                                    previewed,
                                    caption.trim() === ''
                                        ? undefined
                                        : caption.trim(),
                                )
                            }
                        >
                            <Send aria-hidden="true" />
                            <span className="truncate">
                                {t('Send this GIF')}
                            </span>
                        </Button>
                    </div>
                </div>
                {footer}
            </div>
        );
    }

    return (
        <div
            role="dialog"
            aria-label={t('Choose a GIF')}
            data-slot="gif-picker"
            data-view="grid"
            data-status={status}
            className={root}
            onKeyDown={onRootKeyDown}
        >
            <div className="flex min-w-0 flex-col gap-2 border-b p-3">
                <div className="relative flex min-w-0 items-center">
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground"
                    />
                    <Input
                        ref={searchRef}
                        type="search"
                        value={query}
                        disabled={isDisabled}
                        aria-label={t('Search :provider', {
                            provider: providerName,
                        })}
                        placeholder={t('Search :provider', {
                            provider: providerName,
                        })}
                        className="pr-9 pl-8.5 [&::-webkit-search-cancel-button]:hidden"
                        onChange={(event) => changeQuery(event.target.value)}
                    />
                    {query !== '' && !isDisabled && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t('Clear search')}
                                    className="absolute right-1 grid size-7 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => {
                                        changeQuery('');
                                        searchRef.current?.focus();
                                    }}
                                >
                                    <X
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>{t('Clear search')}</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div
                    role="tablist"
                    aria-label={t('GIF categories')}
                    className={cn(
                        'flex [scrollbar-width:none] gap-1.5 overflow-x-auto [mask-image:linear-gradient(90deg,var(--foreground)_85%,transparent)] p-0.5',
                        isDisabled && 'opacity-50',
                    )}
                >
                    {tabs.map((tab, index) => {
                        const isActive = tab === activeTab;
                        const isTabStop = activeTab ? isActive : index === 0;

                        return (
                            <button
                                key={tab.key}
                                ref={(node) => {
                                    tabRefs.current[tab.key] = node;
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={bodyId}
                                tabIndex={isTabStop ? 0 : -1}
                                disabled={isDisabled}
                                className="inline-flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-semibold whitespace-nowrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed aria-selected:border-foreground aria-selected:bg-foreground aria-selected:text-background"
                                onClick={() => changeQuery(tab.query)}
                                onKeyDown={(event) =>
                                    onTabKeyDown(event, index)
                                }
                            >
                                {tab.query === '' && (
                                    <TrendingUp
                                        aria-hidden="true"
                                        className="size-3"
                                    />
                                )}
                                <span className="truncate">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div
                id={bodyId}
                data-slot="gif-picker-body"
                aria-busy={status === 'loading' ? true : undefined}
                className="h-64 min-w-0 overflow-y-auto p-2"
                onScroll={onBodyScroll}
            >
                {status === 'loading' && (
                    <>
                        <p className="flex items-center gap-1.5 px-0.5 pb-1.5 text-overline whitespace-nowrap text-muted-foreground uppercase">
                            <span aria-hidden="true" className="flex gap-0.5">
                                <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                                <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
                            </span>
                            {t('Loading GIFs…')}
                        </p>
                        <div className="grid grid-cols-2 items-start gap-2">
                            {skeletonColumns.map((heights, columnIndex) => (
                                <div
                                    key={columnIndex}
                                    className="flex min-w-0 flex-col gap-2"
                                >
                                    {heights.map((height) => (
                                        <Skeleton
                                            key={height}
                                            className={cn(height, 'rounded-md')}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {status === 'empty' && (
                    <StateBlock
                        icon={SearchX}
                        title={t('No GIF for “:query”', {
                            query: trimmedQuery,
                        })}
                        description={t(
                            'Check the spelling or try a broader word.',
                        )}
                    >
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {suggestionList.slice(0, 3).map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    className="inline-flex h-7 max-w-full items-center rounded-full border bg-card px-2.5 text-xs font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => changeQuery(suggestion)}
                                >
                                    <span className="truncate">
                                        {suggestion}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </StateBlock>
                )}
                {status === 'error' && (
                    <div role="alert" className="h-full">
                        <StateBlock
                            destructive
                            icon={WifiOff}
                            title={t(':provider isn’t responding', {
                                provider: providerName,
                            })}
                            description={t(
                                'Your answers are safe. Check the connection or try again in a moment.',
                            )}
                        >
                            {onRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="max-w-full"
                                    onClick={onRetry}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    <span className="truncate">
                                        {t('Retry')}
                                    </span>
                                </Button>
                            )}
                        </StateBlock>
                    </div>
                )}
                {status === 'rate_limited' && (
                    <div role="alert" className="h-full">
                        <StateBlock
                            destructive
                            icon={Timer}
                            title={t('Too many searches, wait a moment.')}
                            description={t(
                                'The search is paused for a few seconds. Your answers are safe.',
                            )}
                        >
                            {onRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="max-w-full"
                                    onClick={onRetry}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    <span className="truncate">
                                        {t('Retry')}
                                    </span>
                                </Button>
                            )}
                        </StateBlock>
                    </div>
                )}
                {isDisabled && (
                    <StateBlock
                        icon={KeyRound}
                        title={t('GIFs are disabled')}
                        description={t(
                            'An administrator can add a :provider key in Administration → Integrations.',
                            { provider: providerName },
                        )}
                    >
                        {onNotifyAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="max-w-full"
                                onClick={onNotifyAdmin}
                            >
                                <Bell aria-hidden="true" />
                                <span className="truncate">
                                    {t('Notify an admin')}
                                </span>
                            </Button>
                        )}
                    </StateBlock>
                )}
                {status === 'idle' && (
                    <>
                        <p className="flex items-center gap-1 px-0.5 pb-1.5 text-overline text-muted-foreground uppercase">
                            {isReduced && (
                                <Pause
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0"
                                />
                            )}
                            <span className="truncate">
                                {isReduced
                                    ? t(
                                          'Reduced motion: hover or press to play',
                                      )
                                    : trimmedQuery === ''
                                      ? t('Trending now')
                                      : t('Results for “:query”', {
                                            query: trimmedQuery,
                                        })}
                            </span>
                        </p>
                        <div
                            role="listbox"
                            aria-label={
                                trimmedQuery === ''
                                    ? t('Trending now')
                                    : t('Results for “:query”', {
                                          query: trimmedQuery,
                                      })
                            }
                            className="grid grid-cols-2 items-start gap-2 p-0.5"
                        >
                            {columns.map((column, columnIndex) => (
                                <div
                                    key={columnIndex}
                                    role="presentation"
                                    className="flex min-w-0 flex-col gap-2"
                                >
                                    {column.map((gif, rowIndex) => {
                                        const isSelected =
                                            gif.id === selectedId;
                                        const playing = isPlaying(gif);

                                        return (
                                            <div
                                                key={gif.id}
                                                ref={(node) => {
                                                    tileRefs.current[gif.id] =
                                                        node;
                                                }}
                                                role="option"
                                                aria-selected={isSelected}
                                                aria-label={labelFor(gif)}
                                                tabIndex={
                                                    gif.id === rovingId ? 0 : -1
                                                }
                                                data-playing={playing}
                                                style={{
                                                    aspectRatio: `${gif.width} / ${gif.height}`,
                                                }}
                                                className="group relative w-full cursor-pointer overflow-hidden rounded-md bg-muted ring-offset-popover outline-none hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring aria-selected:ring-2 aria-selected:ring-ring aria-selected:ring-offset-2"
                                                onClick={() => choose(gif)}
                                                onKeyDown={(event) =>
                                                    onTileKeyDown(
                                                        event,
                                                        gif,
                                                        columnIndex,
                                                        rowIndex,
                                                    )
                                                }
                                                onFocus={() =>
                                                    setFocusedId(gif.id)
                                                }
                                                onBlur={() =>
                                                    setFocusedId(null)
                                                }
                                                onMouseEnter={() =>
                                                    setHoveredId(gif.id)
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredId(null)
                                                }
                                            >
                                                <GifMedia
                                                    gif={gif}
                                                    label={labelFor(gif)}
                                                    playing={playing}
                                                />
                                                {!playing && (
                                                    <span
                                                        aria-hidden="true"
                                                        data-slot="gif-play"
                                                        className="absolute top-1/2 left-1/2 grid size-8 -translate-1/2 place-items-center rounded-full bg-foreground/70 text-background"
                                                    >
                                                        <Play className="size-3.5" />
                                                    </span>
                                                )}
                                                {gif.title && (
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-foreground/80 to-transparent px-2 pt-5 pb-1.5 text-left text-xs font-semibold text-background opacity-0 transition-opacity duration-140 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none',
                                                            isSelected &&
                                                                'opacity-100',
                                                        )}
                                                    >
                                                        {gif.title}
                                                    </span>
                                                )}
                                                {gif.durationMs !==
                                                    undefined && (
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute right-1.5 bottom-1.5 rounded-full bg-foreground/80 px-1.5 font-mono text-overline font-semibold tracking-normal text-background"
                                                    >
                                                        {formatGifDuration(
                                                            gif.durationMs,
                                                            locale,
                                                        )}
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span
                                                        aria-hidden="true"
                                                        data-slot="gif-tick"
                                                        className="absolute top-1.5 right-1.5 grid size-5.5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-popover"
                                                    >
                                                        <Check className="size-3 stroke-3" />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div aria-live="polite" className="sr-only">
                {announcement}
            </div>
            {footer}
        </div>
    );
}

export function GifPicker({ open, ...props }: GifPickerProps) {
    if (!open) {
        return null;
    }

    return <GifPickerPanel {...props} />;
}
