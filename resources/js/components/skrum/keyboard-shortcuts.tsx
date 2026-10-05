import { Keyboard, Search, SearchX, WandSparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import type {
    ComponentProps,
    KeyboardEvent,
    ReactNode,
    RefObject,
} from 'react';
import { useShortcut } from '@/hooks/use-shortcut';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type Platform = 'mac' | 'other';
export type Mod = 'mod' | 'shift' | 'alt';

export type Shortcut = {
    id: string;
    label: string;
    keys: (Mod | (string & {}))[];
    range?: [from: string, to: string];
    suffix?: string;
    facilitatorOnly?: boolean;
    keywords?: string[];
};

export type ShortcutSectionId =
    | 'general'
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'reactions';

export type ShortcutSection = {
    id: ShortcutSectionId;
    title: string;
    icon: LucideIcon;
    items: Shortcut[];
    note?: string;
};

export type KeyboardShortcutsProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sections: ShortcutSection[];
    context?: ShortcutSectionId;
    platform?: Platform;
    onPlatformChange?: (platform: Platform) => void;
    query?: string;
    onQueryChange?: (query: string) => void;
    onOpenCommandPalette?: () => void;
    /** Single-key shortcuts are turned off: the reference says so. */
    singleKeyDisabled?: boolean;
    /** A control at the end of the footer: the switch, or the way to it. */
    footerExtra?: ReactNode;
};

type KeyLabel = { text: string; spoken: string };

type NavigatorWithUserAgentData = Navigator & {
    userAgentData?: { platform?: string };
};

export function detectPlatform(): Platform {
    if (typeof navigator === 'undefined') {
        return 'other';
    }

    const info = navigator as NavigatorWithUserAgentData;
    const name = info.userAgentData?.platform ?? info.platform ?? '';

    return /mac|iphone|ipad/i.test(name) ? 'mac' : 'other';
}

function keyLabel(key: string, platform: Platform): KeyLabel {
    const mac = platform === 'mac';

    switch (key) {
        case 'mod':
            return mac
                ? { text: '⌘', spoken: 'Command' }
                : { text: 'Ctrl', spoken: 'Control' };
        case 'shift':
            return mac
                ? { text: '⇧', spoken: 'Shift' }
                : { text: 'Shift', spoken: 'Shift' };
        case 'alt':
            return mac
                ? { text: '⌥', spoken: 'Option' }
                : { text: 'Alt', spoken: 'Alt' };
        case 'Enter':
            return { text: '↵', spoken: 'Enter' };
        case 'ArrowRight':
            return { text: '→', spoken: 'Arrow right' };
        case 'ArrowLeft':
            return { text: '←', spoken: 'Arrow left' };
        case 'ArrowUp':
            return { text: '↑', spoken: 'Arrow up' };
        case 'ArrowDown':
            return { text: '↓', spoken: 'Arrow down' };
        case 'Escape':
            return { text: 'Esc', spoken: 'Escape' };
        default:
            return { text: key, spoken: key };
    }
}

function fold(value: string): string {
    return Array.from(value)
        .map((char) =>
            char
                .normalize('NFD')
                .replace(/\p{M}/gu, '')
                .toLowerCase()
                .padEnd(1)
                .slice(0, 1),
        )
        .join('');
}

function searchableText(item: Shortcut, platform: Platform): string {
    const keyText = [...item.keys, ...(item.range ?? [])]
        .map((key) => keyLabel(key, platform).text)
        .join(' ');

    return fold([item.label, ...(item.keywords ?? []), keyText].join(' '));
}

export function filterSections(
    sections: ShortcutSection[],
    query: string,
    platform: Platform,
): ShortcutSection[] {
    const needle = fold(query.trim());

    if (needle === '') {
        return sections;
    }

    return sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) =>
                searchableText(item, platform).includes(needle),
            ),
        }))
        .filter((section) => section.items.length > 0);
}

export function orderSections(
    sections: ShortcutSection[],
    context?: ShortcutSectionId,
): ShortcutSection[] {
    const general = sections.filter((section) => section.id === 'general');
    const current =
        context && context !== 'general'
            ? sections.filter((section) => section.id === context)
            : [];
    const rest = sections.filter(
        (section) => !general.includes(section) && !current.includes(section),
    );

    return [...general, ...current, ...rest];
}

function Highlight({ text, query }: { text: string; query: string }) {
    const needle = fold(query.trim());
    const start = needle === '' ? -1 : fold(text).indexOf(needle);

    if (start === -1) {
        return <>{text}</>;
    }

    const chars = Array.from(text);
    const end = start + needle.length;

    return (
        <>
            {chars.slice(0, start).join('')}
            <mark className="rounded-xs bg-skrum-primary-soft font-semibold text-skrum-primary-text">
                {chars.slice(start, end).join('')}
            </mark>
            {chars.slice(end).join('')}
        </>
    );
}

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
    return (
        <kbd
            data-slot="kbd"
            className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-xs border border-b-2 bg-muted px-1.25 font-mono text-overline text-foreground',
                className,
            )}
            {...props}
        />
    );
}

function Keys({
    shortcut,
    platform,
}: {
    shortcut: Shortcut;
    platform: Platform;
}) {
    const { t } = useTrans();
    const groups: ReactNode[] = [];
    const spoken: string[] = [];

    shortcut.keys.forEach((key, index) => {
        const label = keyLabel(key, platform);

        spoken.push(label.spoken);
        groups.push(<Kbd key={`${key}-${index}`}>{label.text}</Kbd>);
    });

    if (shortcut.range) {
        const [from, to] = shortcut.range;

        spoken.push(`${from} ${t('to')} ${to}`);
        groups.push(
            <Kbd key="from">{from}</Kbd>,
            <span key="dash" aria-hidden="true">
                –
            </span>,
            <Kbd key="to">{to}</Kbd>,
        );
    }

    if (shortcut.suffix) {
        spoken.push(shortcut.suffix);
        groups.push(
            <span key="suffix" className="ml-1">
                {shortcut.suffix}
            </span>,
        );
    }

    return (
        <span
            role="group"
            aria-label={spoken.join(' ')}
            data-slot="keyboard-shortcuts-keys"
            className="flex shrink-0 items-center gap-0.75 text-xs whitespace-nowrap text-muted-foreground"
        >
            {groups}
        </span>
    );
}

function FacilitatorMark() {
    const { t } = useTrans();

    return (
        <WandSparkles
            role="img"
            aria-label={t('Facilitator only')}
            className="size-3.5 shrink-0 text-skrum-primary-text"
        />
    );
}

function ShortcutRow({
    shortcut,
    platform,
    query,
}: {
    shortcut: Shortcut;
    platform: Platform;
    query: string;
}) {
    return (
        <li
            data-slot="keyboard-shortcuts-row"
            className="flex min-h-8 items-center justify-between gap-3 py-1 text-body-sm"
        >
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0">
                    <Highlight text={shortcut.label} query={query} />
                </span>
                {shortcut.facilitatorOnly ? <FacilitatorMark /> : null}
            </span>
            <Keys shortcut={shortcut} platform={platform} />
        </li>
    );
}

function ReactionTile({
    shortcut,
    platform,
}: {
    shortcut: Shortcut;
    platform: Platform;
}) {
    const spoken = shortcut.keys
        .map((key) => keyLabel(key, platform).spoken)
        .join(' ');

    return (
        <li
            data-slot="keyboard-shortcuts-reaction"
            aria-label={`${shortcut.label}: ${spoken}`}
            className="flex flex-col items-center gap-1 rounded-md bg-muted py-1.5 text-lg"
        >
            <span aria-hidden="true">{shortcut.label}</span>
            <Kbd aria-hidden="true">
                {shortcut.keys.map((key) => keyLabel(key, platform).text)}
            </Kbd>
        </li>
    );
}

function SectionBlock({
    section,
    platform,
    query,
}: {
    section: ShortcutSection;
    platform: Platform;
    query: string;
}) {
    const Icon = section.icon;
    const isReactions = section.id === 'reactions';

    return (
        <section
            aria-label={section.title}
            data-slot="keyboard-shortcuts-section"
            data-section={section.id}
            className="mb-5 break-inside-avoid"
        >
            <h3 className="mb-1 flex items-center gap-2 border-b pb-1.5 text-overline text-muted-foreground uppercase">
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{section.title}</span>
            </h3>
            <ul
                role="list"
                className={cn(isReactions && 'mt-2 grid grid-cols-6 gap-1')}
            >
                {section.items.map((shortcut) =>
                    isReactions ? (
                        <ReactionTile
                            key={shortcut.id}
                            shortcut={shortcut}
                            platform={platform}
                        />
                    ) : (
                        <ShortcutRow
                            key={shortcut.id}
                            shortcut={shortcut}
                            platform={platform}
                            query={query}
                        />
                    ),
                )}
            </ul>
            {section.note ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    {section.note}
                </p>
            ) : null}
        </section>
    );
}

export type KeyboardShortcutsPanelProps = Omit<
    KeyboardShortcutsProps,
    'open' | 'onOpenChange'
> & { className?: string };

function ShortcutsContent({
    title,
    description,
    searchRef,
    sections,
    context,
    platform: platformProp,
    onPlatformChange,
    query: queryProp,
    onQueryChange,
    onOpenCommandPalette,
    singleKeyDisabled = false,
    footerExtra,
}: Omit<KeyboardShortcutsPanelProps, 'className'> & {
    title: ReactNode;
    description?: ReactNode;
    searchRef: RefObject<HTMLInputElement | null>;
}) {
    const { t } = useTrans();
    const bodyRef = useRef<HTMLDivElement>(null);
    const [detected] = useState<Platform>(detectPlatform);
    const [platformState, setPlatformState] = useState<Platform | null>(null);
    const [queryState, setQueryState] = useState('');

    const platform = platformProp ?? platformState ?? detected;
    const query = queryProp ?? queryState;

    const visible = useMemo(
        () => filterSections(orderSections(sections, context), query, platform),
        [sections, context, query, platform],
    );
    const resultCount = visible.reduce(
        (total, section) => total + section.items.length,
        0,
    );
    const searching = query.trim() !== '';

    const changePlatform = (next: Platform): void => {
        setPlatformState(next);
        onPlatformChange?.(next);
    };

    const changeQuery = (next: string): void => {
        setQueryState(next);
        onQueryChange?.(next);
    };

    const scrollBody = (event: KeyboardEvent<HTMLElement>): void => {
        const body = bodyRef.current;

        if (!body) {
            return;
        }

        const page = body.clientHeight * 0.9;
        const amounts: Record<string, number> = {
            ArrowDown: 48,
            ArrowUp: -48,
            PageDown: page,
            PageUp: -page,
        };
        const amount = amounts[event.key];

        if (amount === undefined) {
            return;
        }

        event.preventDefault();
        body.scrollBy?.({ top: amount });
    };

    return (
        <>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 pr-14 pb-3 pl-5">
                <Keyboard
                    aria-hidden="true"
                    className="size-5 shrink-0 text-skrum-primary-text"
                />
                {title}
                <Tabs<Platform>
                    aria-label={t('Platform')}
                    value={platform}
                    onValueChange={changePlatform}
                    className="ml-auto"
                    items={[
                        { value: 'mac', label: t('macOS') },
                        { value: 'other', label: t('Windows · Linux') },
                    ]}
                />
            </header>
            {description}

            <div className="flex h-11 shrink-0 items-center gap-2 border-y px-5 text-ui-lg focus-within:border-b-2 focus-within:border-b-ring">
                <Search
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                />
                <Input
                    ref={searchRef}
                    type="search"
                    value={query}
                    aria-label={t('Search shortcuts')}
                    placeholder={t('Search shortcuts')}
                    onChange={(event) => changeQuery(event.target.value)}
                    onKeyDown={scrollBody}
                    className="h-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <span
                    role="status"
                    aria-live="polite"
                    className="shrink-0 text-xs whitespace-nowrap text-muted-foreground empty:-ml-2"
                >
                    {searching
                        ? resultCount === 1
                            ? t('1 result')
                            : t(':count results', { count: resultCount })
                        : null}
                </span>
                {!searching && !singleKeyDisabled && (
                    <Kbd aria-hidden="true">/</Kbd>
                )}
            </div>
            {singleKeyDisabled && (
                <p
                    role="status"
                    data-slot="keyboard-shortcuts-single-key-off"
                    className="shrink-0 border-b bg-skrum-warning-soft px-5 py-2 text-xs font-medium text-skrum-warning-text"
                >
                    {t(
                        'Single-key shortcuts are off. Shortcuts with ⌘ or Ctrl still work.',
                    )}
                </p>
            )}

            <div
                ref={bodyRef}
                tabIndex={0}
                role="group"
                aria-label={t('Keyboard shortcuts')}
                onKeyDown={scrollBody}
                data-slot="keyboard-shortcuts-body"
                className="min-h-0 flex-1 columns-xs gap-8 overflow-y-auto px-5 pt-4 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
                {visible.length === 0 ? (
                    <div
                        data-slot="keyboard-shortcuts-empty"
                        className="flex flex-col items-center gap-3 py-10 text-center"
                    >
                        <SearchX
                            aria-hidden="true"
                            className="size-8 text-muted-foreground"
                        />
                        <p className="text-body-sm text-muted-foreground">
                            {t('No shortcut for “:query”', {
                                query: query.trim(),
                            })}
                        </p>
                        {onOpenCommandPalette ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onOpenCommandPalette}
                            >
                                <span className="truncate">
                                    {t('Open the command palette')}
                                </span>
                                <Kbd>{keyLabel('mod', platform).text}K</Kbd>
                            </Button>
                        ) : null}
                    </div>
                ) : (
                    visible.map((section) => (
                        <SectionBlock
                            key={section.id}
                            section={section}
                            platform={platform}
                            query={query}
                        />
                    ))
                )}
            </div>

            <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted px-5 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    {singleKeyDisabled ? (
                        <>
                            <Kbd>{keyLabel('mod', platform).text}</Kbd>
                            <Kbd>/</Kbd>
                        </>
                    ) : (
                        <Kbd>?</Kbd>
                    )}
                    {t('at any time')}
                </span>
                <span className="flex items-center gap-1.5">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    {t('scroll')}
                </span>
                <span className="flex items-center gap-1.5">
                    <Kbd>Esc</Kbd>
                    {t('close')}
                </span>
                <span className="flex items-center gap-1.5">
                    <WandSparkles
                        aria-hidden="true"
                        className="size-3.5 text-skrum-primary-text"
                    />
                    {t('facilitator only')}
                </span>
                {footerExtra && (
                    <span
                        data-slot="keyboard-shortcuts-footer-extra"
                        className="ml-auto flex min-w-0 items-center gap-2"
                    >
                        {footerExtra}
                    </span>
                )}
            </footer>
        </>
    );
}

/** The reference without its dialog shell, for a page or the bench. */
export function KeyboardShortcutsPanel({
    className,
    ...props
}: KeyboardShortcutsPanelProps) {
    const { t } = useTrans();
    const titleId = useId();
    const searchRef = useRef<HTMLInputElement>(null);

    return (
        <section
            aria-labelledby={titleId}
            data-slot="keyboard-shortcuts-panel"
            className={cn(
                'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-card',
                className,
            )}
        >
            <ShortcutsContent
                {...props}
                searchRef={searchRef}
                title={
                    <h2
                        id={titleId}
                        className="min-w-0 truncate text-lg font-semibold"
                    >
                        {t('Keyboard shortcuts')}
                    </h2>
                }
            />
        </section>
    );
}

/**
 * Where focus returns when the dialog closes. An item of a menu is gone by
 * then, as the menu closed: its trigger stands for it.
 */
function focusOrigin(element: Element | null): Element | null {
    const triggerId = element
        ?.closest('[role="menu"]')
        ?.getAttribute('aria-labelledby');

    return (triggerId ? document.getElementById(triggerId) : null) ?? element;
}

export function KeyboardShortcuts({
    open,
    onOpenChange,
    ...panel
}: KeyboardShortcutsProps) {
    const { t } = useTrans();
    const titleId = useId();
    const searchRef = useRef<HTMLInputElement>(null);
    const [wasOpen, setWasOpen] = useState(open);
    const [opener, setOpener] = useState<Element | null>(() =>
        open && typeof document !== 'undefined'
            ? focusOrigin(document.activeElement)
            : null,
    );

    if (open !== wasOpen) {
        setWasOpen(open);

        if (open) {
            setOpener(focusOrigin(document.activeElement));
        }
    }

    useShortcut('/', () => searchRef.current?.focus(), { enabled: open });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-labelledby={titleId}
                aria-describedby={undefined}
                closeLabel={t('Close')}
                data-slot="keyboard-shortcuts"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    searchRef.current?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();

                    if (opener instanceof HTMLElement && opener.isConnected) {
                        opener.focus();
                    }
                }}
                className="flex flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-190"
            >
                <ShortcutsContent
                    {...panel}
                    searchRef={searchRef}
                    title={
                        <DialogTitle id={titleId} className="min-w-0 truncate">
                            {t('Keyboard shortcuts')}
                        </DialogTitle>
                    }
                    description={
                        <DialogDescription className="sr-only">
                            {t(
                                'Reference of the keyboard shortcuts of the app',
                            )}
                        </DialogDescription>
                    }
                />
            </DialogContent>
        </Dialog>
    );
}

export function KeyboardShortcutsTrigger({
    onClick,
    className,
}: {
    onClick: () => void;
    className?: string;
}) {
    const { t } = useTrans();

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('Keyboard shortcuts')}
                    aria-haspopup="dialog"
                    onClick={onClick}
                    className={className}
                >
                    <Keyboard aria-hidden="true" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <span className="flex items-center gap-1.5">
                    {t('Keyboard shortcuts')}
                    <Kbd className="border-primary-foreground/30 bg-transparent text-primary-foreground">
                        ?
                    </Kbd>
                </span>
            </TooltipContent>
        </Tooltip>
    );
}
