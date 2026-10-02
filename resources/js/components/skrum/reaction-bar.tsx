import { Ellipsis, Lock, SmilePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
    CSSProperties,
    HTMLAttributes,
    KeyboardEvent,
    ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type QuickEmoji = '👍' | '❤️' | '👏' | '🎉' | '🤔' | '👎';

export type IncomingReaction = {
    id: string;
    emoji: string;
    userName?: string;
    presence?: number;
};

export type ReactionBarProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'role' | 'children'
> & {
    emojis?: QuickEmoji[];
    variant?: 'floating' | 'inline';
    compact?: boolean;
    compactEmojis?: QuickEmoji[];
    disabled?: boolean;
    disabledReason?: string;
    offsetBottom?: number;
    incoming?: IncomingReaction[];
    shortcuts?: boolean;
    pickerOpen?: boolean;
    picker?: ReactNode;
    onReact: (emoji: string) => void;
    onOpenPicker?: () => void;
    labels?: Partial<Record<QuickEmoji | 'add' | 'more', string>>;
};

export const DefaultQuickEmojis: QuickEmoji[] = [
    '👍',
    '❤️',
    '👏',
    '🎉',
    '🤔',
    '👎',
];

const DefaultCompactEmojis: QuickEmoji[] = ['👍', '❤️', '🎉'];
const MaxVisibleIncoming = 12;
const AnnounceIntervalMs = 5000;
const PressedMs = 360;

function countByEmoji(
    reactions: IncomingReaction[],
): Map<string, IncomingReaction[]> {
    const groups = new Map<string, IncomingReaction[]>();

    for (const reaction of reactions) {
        groups.set(reaction.emoji, [
            ...(groups.get(reaction.emoji) ?? []),
            reaction,
        ]);
    }

    return groups;
}

const PresenceClasses: Record<number, string> = {
    1: 'bg-skrum-presence-1 text-skrum-presence-1-foreground',
    2: 'bg-skrum-presence-2 text-skrum-presence-2-foreground',
    3: 'bg-skrum-presence-3 text-skrum-presence-3-foreground',
    4: 'bg-skrum-presence-4 text-skrum-presence-4-foreground',
    5: 'bg-skrum-presence-5 text-skrum-presence-5-foreground',
    6: 'bg-skrum-presence-6 text-skrum-presence-6-foreground',
    7: 'bg-skrum-presence-7 text-skrum-presence-7-foreground',
    8: 'bg-skrum-presence-8 text-skrum-presence-8-foreground',
    9: 'bg-skrum-presence-9 text-skrum-presence-9-foreground',
    10: 'bg-skrum-presence-10 text-skrum-presence-10-foreground',
    11: 'bg-skrum-presence-11 text-skrum-presence-11-foreground',
    12: 'bg-skrum-presence-12 text-skrum-presence-12-foreground',
};

function presenceClass(presence?: number): string {
    if (presence === undefined) {
        return 'bg-muted text-muted-foreground';
    }

    const slot = ((Math.abs(Math.trunc(presence)) - 1 + 12) % 12) + 1;

    return PresenceClasses[slot];
}

function flyOffset(id: string, index: number): string {
    let hash = index;

    for (const char of id) {
        hash = (hash * 31 + char.charCodeAt(0)) % 997;
    }

    return `${((hash % 9) - 4) * 0.75}rem`;
}

function useThrottledAnnouncement(text: string): string {
    const [announced, setAnnounced] = useState('');
    const lastAt = useRef(0);

    useEffect(() => {
        if (text === '') {
            return;
        }

        const wait = Math.max(
            0,
            lastAt.current + AnnounceIntervalMs - Date.now(),
        );
        const timer = setTimeout(() => {
            lastAt.current = Date.now();
            setAnnounced(text);
        }, wait);

        return () => clearTimeout(timer);
    }, [text]);

    return announced;
}

function IncomingLayer({ incoming }: { incoming: IncomingReaction[] }) {
    const { t } = useTrans();
    const visible = incoming.slice(-MaxVisibleIncoming);
    const overflow = incoming.slice(0, incoming.length - visible.length);
    const overflowGroups = [...countByEmoji(overflow).entries()];

    if (incoming.length === 0) {
        return null;
    }

    return (
        <div
            data-slot="reaction-incoming"
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-full flex h-32 flex-col items-center justify-end gap-1 pb-2"
        >
            {overflowGroups.map(([emoji, group]) => {
                const first = group[0];
                const others = group.length - 1;
                const name =
                    first.userName === undefined
                        ? null
                        : others > 0
                          ? t(':name and :count others', {
                                name: first.userName,
                                count: others,
                            })
                          : first.userName;

                return (
                    <span
                        key={emoji}
                        data-slot="reaction-aggregate"
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-popover px-2.5 py-1 text-xs font-semibold shadow-card"
                    >
                        <span>{`${emoji} ×${group.length}`}</span>
                        {name !== null && (
                            <span className="truncate text-muted-foreground">
                                {`· ${name}`}
                            </span>
                        )}
                    </span>
                );
            })}
            <div className="relative h-0 w-full">
                {visible.map((reaction, index) => (
                    <span
                        key={reaction.id}
                        data-slot="reaction-fly"
                        style={{ marginLeft: flyOffset(reaction.id, index) }}
                        className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center motion-safe:animate-reaction-rise motion-reduce:animate-pulse"
                    >
                        <span className="text-3xl">{reaction.emoji}</span>
                        {reaction.userName !== undefined && (
                            <span
                                className={cn(
                                    'max-w-24 truncate rounded-full px-1.5 text-xs font-semibold',
                                    presenceClass(reaction.presence),
                                )}
                            >
                                {reaction.userName}
                            </span>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function ReactionBar({
    emojis = DefaultQuickEmojis,
    variant = 'floating',
    compact = false,
    compactEmojis = DefaultCompactEmojis,
    disabled = false,
    disabledReason,
    offsetBottom,
    incoming = [],
    shortcuts = false,
    pickerOpen,
    picker,
    onReact,
    onOpenPicker,
    labels,
    className,
    style,
    onKeyDown,
    ...rest
}: ReactionBarProps) {
    const { t } = useTrans();
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [pressed, setPressed] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const names: Record<QuickEmoji, string> = {
        '👍': t('Thumbs up'),
        '❤️': t('Heart'),
        '👏': t('Clap'),
        '🎉': t('Celebrate'),
        '🤔': t('Thinking'),
        '👎': t('Thumbs down'),
        ...labels,
    };
    const shown = compact ? compactEmojis : emojis;
    const lockedReason = disabledReason ?? t('Reactions are locked.');
    const isFloating = variant === 'floating';
    const showAddButton = !compact && onOpenPicker !== undefined;
    const rovingCount =
        shown.length + (compact ? 1 : 0) + (showAddButton ? 1 : 0);
    const safeActive = Math.min(activeIndex, rovingCount - 1);

    const counts = countByEmoji(incoming);
    const summary = [...counts.entries()]
        .map(([emoji, group]) => `${group.length} ${emoji}`)
        .join(' ');
    const announced = useThrottledAnnouncement(
        summary === '' ? '' : t('Reactions received: :summary', { summary }),
    );

    useEffect(() => {
        return () => {
            if (pressTimer.current !== null) {
                clearTimeout(pressTimer.current);
            }
        };
    }, []);

    const react = (emoji: string): void => {
        if (disabled) {
            return;
        }

        setPressed(emoji);

        if (pressTimer.current !== null) {
            clearTimeout(pressTimer.current);
        }

        pressTimer.current = setTimeout(() => setPressed(null), PressedMs);
        onReact(emoji);
    };

    useShortcut(
        ['1', '2', '3', '4', '5', '6'],
        (event) => {
            const emoji = emojis[Number(event.key) - 1];

            if (emoji !== undefined) {
                react(emoji);
            }
        },
        { enabled: shortcuts && !disabled, scope: toolbarRef },
    );

    function moveFocus(event: KeyboardEvent<HTMLDivElement>): void {
        onKeyDown?.(event);

        const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

        if (!keys.includes(event.key)) {
            return;
        }

        const buttons = Array.from(
            toolbarRef.current?.querySelectorAll<HTMLElement>(
                '[data-roving]',
            ) ?? [],
        );
        const current = buttons.findIndex(
            (button) => button === document.activeElement,
        );

        if (current === -1) {
            return;
        }

        event.preventDefault();

        const next =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? buttons.length - 1
                  : (current +
                        (event.key === 'ArrowRight' ? 1 : -1) +
                        buttons.length) %
                    buttons.length;

        setActiveIndex(next);
        buttons[next]?.focus();
    }

    const buttonClass = (isPressed: boolean): string =>
        cn(
            'relative size-11 shrink-0 rounded-full text-xl hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            isPressed && 'bg-skrum-primary-soft ring-1 ring-primary ring-inset',
            disabled && 'opacity-45',
        );

    const tooltipFor = (emoji: QuickEmoji, index: number): ReactNode => (
        <span className="inline-flex items-center gap-2">
            <span>{names[emoji]}</span>
            {shortcuts && !compact && (
                <kbd className="rounded-sm border border-background/35 px-1 font-mono text-xs">
                    {index + 1}
                </kbd>
            )}
        </span>
    );

    return (
        <div
            data-slot="reaction-bar"
            data-variant={variant}
            className={cn(
                isFloating
                    ? 'fixed inset-x-0 z-30 mx-auto flex w-fit flex-col items-center'
                    : 'relative flex w-fit flex-col items-center',
                isFloating && offsetBottom === undefined && 'bottom-6',
                isFloating &&
                    offsetBottom !== undefined &&
                    'bottom-(--reaction-offset)',
            )}
            style={
                isFloating && offsetBottom !== undefined
                    ? ({
                          '--reaction-offset': `calc(${offsetBottom}rem + 0.75rem)`,
                      } as CSSProperties)
                    : undefined
            }
        >
            <IncomingLayer incoming={incoming} />
            {disabled && (
                <span
                    data-slot="reaction-locked"
                    className="mb-1 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{lockedReason}</span>
                </span>
            )}
            <div
                {...rest}
                ref={toolbarRef}
                role="toolbar"
                aria-label={t('Reactions')}
                aria-orientation="horizontal"
                style={style}
                onKeyDown={moveFocus}
                className={cn(
                    'flex items-center gap-0.5 p-1',
                    isFloating &&
                        !disabled &&
                        'rounded-full border border-border bg-popover shadow-raised',
                    isFloating &&
                        disabled &&
                        'rounded-full border border-border bg-popover',
                    className,
                )}
            >
                {shown.map((emoji, index) => (
                    <Tooltip key={emoji}>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                data-roving
                                data-emoji={emoji}
                                tabIndex={safeActive === index ? 0 : -1}
                                aria-label={`${t('Send a reaction')} ${emoji}`}
                                aria-disabled={disabled || undefined}
                                aria-keyshortcuts={
                                    shortcuts && !compact
                                        ? String(index + 1)
                                        : undefined
                                }
                                className={buttonClass(pressed === emoji)}
                                onFocus={() => setActiveIndex(index)}
                                onClick={() => react(emoji)}
                            >
                                <span aria-hidden>{emoji}</span>
                                {pressed === emoji && (
                                    <span
                                        data-slot="reaction-plus-one"
                                        aria-hidden
                                        className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground motion-safe:animate-reaction-rise"
                                    >
                                        +1
                                    </span>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {disabled ? lockedReason : tooltipFor(emoji, index)}
                        </TooltipContent>
                    </Tooltip>
                ))}
                {compact && (
                    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <DrawerTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                data-roving
                                tabIndex={safeActive === shown.length ? 0 : -1}
                                aria-label={labels?.more ?? t('More reactions')}
                                aria-expanded={drawerOpen}
                                aria-disabled={disabled || undefined}
                                className={buttonClass(false)}
                                onFocus={() => setActiveIndex(shown.length)}
                                onClick={(event) => {
                                    if (disabled) {
                                        event.preventDefault();
                                    }
                                }}
                            >
                                <Ellipsis className="size-5" aria-hidden />
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>{t('Reactions')}</DrawerTitle>
                                <DrawerDescription className="sr-only">
                                    {t('Send a reaction')}
                                </DrawerDescription>
                            </DrawerHeader>
                            <div className="grid grid-cols-3 gap-2 p-4">
                                {emojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        data-slot="reaction-drawer-item"
                                        aria-label={`${t('Send a reaction')} ${emoji}`}
                                        className="flex min-h-17 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 text-2xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                        onClick={() => {
                                            react(emoji);
                                            setDrawerOpen(false);
                                        }}
                                    >
                                        <span aria-hidden>{emoji}</span>
                                        <span
                                            aria-hidden
                                            className="max-w-full truncate text-xs font-medium text-muted-foreground"
                                        >
                                            {names[emoji]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {onOpenPicker !== undefined && (
                                <div className="p-4 pt-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            setDrawerOpen(false);
                                            onOpenPicker();
                                        }}
                                    >
                                        <SmilePlus aria-hidden />
                                        <span className="truncate">
                                            {t('More emoji…')}
                                        </span>
                                    </Button>
                                </div>
                            )}
                        </DrawerContent>
                    </Drawer>
                )}
                {!compact && (showAddButton || picker !== undefined) && (
                    <span
                        aria-hidden
                        data-slot="reaction-separator"
                        className="mx-1 h-6 w-px shrink-0 bg-border"
                    />
                )}
                {showAddButton && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-roving
                        tabIndex={safeActive === shown.length ? 0 : -1}
                        aria-label={labels?.add ?? t('Send a reaction')}
                        aria-expanded={pickerOpen ?? false}
                        aria-disabled={disabled || undefined}
                        className={buttonClass(pickerOpen === true)}
                        onFocus={() => setActiveIndex(shown.length)}
                        onClick={() => {
                            if (!disabled) {
                                onOpenPicker?.();
                            }
                        }}
                    >
                        <SmilePlus className="size-5" aria-hidden />
                    </Button>
                )}
                {!compact && picker}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
                {announced}
            </div>
        </div>
    );
}
