import {
    defaultEmojiDataResolver,
    EmojiPicker as Frimousse,
    getEmojiDetails,
    type EmojiDataResolver,
    type EmojiPickerListCategoryHeaderProps,
    type EmojiPickerListComponents,
    type EmojiPickerListEmojiProps,
} from 'frimousse';
import { Plus, Search } from 'lucide-react';
import {
    useCallback,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { ReactionPickerGrid } from '@/components/skrum/reaction-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { pushRecent, readRecent } from '@/lib/emoji/recent';
import type { EmojiDataLocation } from '@/lib/games/types';
import { QuickEmoji } from '@/lib/retro/emoji';
import { cn } from '@/lib/utils';
import { useOptionalBoard } from './board-context';
import { dragIsolation } from './dnd';

type Props = {
    onPick: (emoji: string) => void;
    label: string;
    children: ReactNode;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

const Columns = 8;

const HeaderClass =
    'bg-popover px-1 pt-2 pb-1 text-overline text-muted-foreground uppercase';

const CellClass =
    'grid size-8 place-items-center rounded-md text-xl outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-accent';

function CategoryHeader({
    category,
    ...props
}: EmojiPickerListCategoryHeaderProps) {
    return (
        <div className={HeaderClass} {...props}>
            {category.label}
        </div>
    );
}

function Emoji({ emoji, ...props }: EmojiPickerListEmojiProps) {
    return (
        <button type="button" className={CellClass} {...props}>
            {emoji.emoji}
        </button>
    );
}

const ListComponents: Partial<EmojiPickerListComponents> = {
    CategoryHeader,
    Emoji,
};

/** The viewer's emoji list: the one given, else the retro board's. */
export function useEmojiData(
    emojiData?: EmojiDataLocation,
): EmojiDataLocation | null {
    const board = useOptionalBoard();

    return emojiData ?? board?.board.emojiData ?? null;
}

type EmojiPickerPanelProps = {
    onPick: (emoji: string) => void;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
    className?: string;
};

/**
 * The full emoji set: search, the viewer's recent picks, the categories and a
 * footer naming the pointed emoji. Renders nothing without an emoji list.
 */
export function EmojiPickerPanel({
    onPick,
    emojiData,
    className,
}: EmojiPickerPanelProps) {
    const { t } = useTrans();
    const data = useEmojiData(emojiData);
    const [unavailable, setUnavailable] = useState(false);
    const [search, setSearch] = useState('');
    const [recent] = useState(() => readRecent().slice(0, Columns));
    const [pointedRecent, setPointedRecent] = useState<string | null>(null);

    /**
     * frimousse only logs a failed load and keeps showing its loading
     * state, so the failure is caught here to tell the viewer.
     */
    const resolveEmojiData = useCallback<EmojiDataResolver>(
        async (locale, options) => {
            try {
                const data = await defaultEmojiDataResolver(locale, options);

                setUnavailable(false);

                return data;
            } catch (error) {
                if (!options.signal?.aborted) {
                    setUnavailable(true);
                }

                throw error;
            }
        },
        [],
    );

    if (data === null) {
        return null;
    }

    function select(emoji: string): void {
        pushRecent(emoji);
        onPick(emoji);
    }

    function moveInRecent(event: KeyboardEvent<HTMLButtonElement>): void {
        const sibling =
            event.key === 'ArrowRight'
                ? event.currentTarget.nextElementSibling
                : event.key === 'ArrowLeft'
                  ? event.currentTarget.previousElementSibling
                  : null;

        if (sibling instanceof HTMLElement) {
            event.preventDefault();
            sibling.focus();
        }
    }

    return (
        <Frimousse.Root
            data-slot="emoji-picker"
            className={cn('flex w-69 max-w-full flex-col', className)}
            columns={Columns}
            locale={data.locale}
            emojibaseUrl={data.baseUrl}
            resolveEmojiData={resolveEmojiData}
            onEmojiSelect={({ emoji }) => select(emoji)}
        >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 focus-within:border-ring">
                <Search
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <Frimousse.Search
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                    placeholder={t('Search an emoji…')}
                    aria-label={t('Search an emoji…')}
                />
            </div>
            {unavailable && (
                <p
                    role="alert"
                    className="px-3 pt-2 text-body-sm text-skrum-destructive-text"
                >
                    {t('Emoji list unavailable')}
                </p>
            )}
            {search === '' && recent.length > 0 && (
                <div
                    role="group"
                    aria-label={t('Recent')}
                    data-slot="emoji-recent"
                    className="shrink-0 pl-2"
                >
                    <div aria-hidden className={HeaderClass}>
                        {t('Recent')}
                    </div>
                    <div className="flex">
                        {recent.map((emoji, index) => (
                            <button
                                key={emoji}
                                type="button"
                                aria-label={emoji}
                                tabIndex={index === 0 ? 0 : -1}
                                className={CellClass}
                                onClick={() => select(emoji)}
                                onKeyDown={moveInRecent}
                                onPointerEnter={() => setPointedRecent(emoji)}
                                onPointerLeave={() => setPointedRecent(null)}
                                onFocus={() => setPointedRecent(emoji)}
                                onBlur={() => setPointedRecent(null)}
                            >
                                <span aria-hidden>{emoji}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <Frimousse.Viewport className="scrollbar-themed h-56 pl-2">
                {!unavailable && (
                    <Frimousse.Loading className="block p-2 text-sm text-muted-foreground">
                        {t('Loading…')}
                    </Frimousse.Loading>
                )}
                <Frimousse.Empty className="block p-2 text-sm text-muted-foreground">
                    {t('No emoji matches')}
                </Frimousse.Empty>
                <Frimousse.List
                    className="select-none"
                    components={ListComponents}
                />
            </Frimousse.Viewport>
            <div
                data-slot="emoji-picker-footer"
                className="flex h-11 shrink-0 items-center gap-2 border-t border-border pr-1.5 pl-3"
            >
                <Frimousse.ActiveEmoji>
                    {({ emoji }) => {
                        const pointed =
                            emoji ??
                            (pointedRecent === null
                                ? undefined
                                : {
                                      emoji: pointedRecent,
                                      label:
                                          getEmojiDetails(pointedRecent, {
                                              locale: data.locale,
                                              emojibaseUrl: data.baseUrl,
                                          })?.label ?? '',
                                  });

                        return (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                {pointed === undefined ? (
                                    <span className="truncate text-sm text-muted-foreground">
                                        {t('Pick an emoji')}
                                    </span>
                                ) : (
                                    <>
                                        <span className="text-2xl" aria-hidden>
                                            {pointed.emoji}
                                        </span>
                                        <span className="truncate text-sm">
                                            {pointed.label}
                                        </span>
                                    </>
                                )}
                            </div>
                        );
                    }}
                </Frimousse.ActiveEmoji>
                <Frimousse.SkinToneSelector
                    className={cn(CellClass, 'shrink-0')}
                    aria-label={t('Change skin tone')}
                />
            </div>
        </Frimousse.Root>
    );
}

type EmojiSearchDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label: string;
    onPick: (emoji: string) => void;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

/** The picker in a dialog, where no button anchors it: the phone's drawer. */
export function EmojiSearchDialog({
    open,
    onOpenChange,
    label,
    onPick,
    emojiData,
}: EmojiSearchDialogProps) {
    if (useEmojiData(emojiData) === null) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...dragIsolation}
                size="sm"
                aria-describedby={undefined}
                className="grid-cols-[minmax(0,1fr)]"
            >
                <DialogTitle>{label}</DialogTitle>
                <EmojiPickerPanel
                    className="mx-auto rounded-lg border border-border"
                    emojiData={emojiData}
                    onPick={(emoji) => {
                        onOpenChange(false);
                        onPick(emoji);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

/**
 * The six usual reactions behind a button, ending with "More emoji" that
 * swaps them for the full picker in the same popover.
 */
export function EmojiPicker({ onPick, label, children, emojiData }: Props) {
    const { t } = useTrans();
    const hasFullList = useEmojiData(emojiData) !== null;
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'quick' | 'full' | 'returned'>('quick');

    function pick(emoji: string): void {
        setOpen(false);
        onPick(emoji);
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (next) {
                    setView('quick');
                }
            }}
        >
            <PopoverTrigger asChild aria-label={label}>
                {children}
            </PopoverTrigger>
            <PopoverContent
                {...dragIsolation}
                aria-label={label}
                className="max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
                onEscapeKeyDown={(event) => {
                    if (view === 'full') {
                        event.preventDefault();
                        setView('returned');
                    }
                }}
            >
                {view === 'full' ? (
                    <EmojiPickerPanel emojiData={emojiData} onPick={pick} />
                ) : (
                    <div
                        data-slot="emoji-quick-list"
                        className="flex items-center gap-1 p-2"
                    >
                        <ReactionPickerGrid
                            emojis={[...QuickEmoji]}
                            mine={[]}
                            label={label}
                            onToggle={(emoji) => {
                                pushRecent(emoji);
                                pick(emoji);
                            }}
                        />
                        {hasFullList && (
                            // Back from the picker the focus lands here: an
                            // open tooltip would take the Esc that closes.
                            <Tooltip
                                open={view === 'returned' ? false : undefined}
                            >
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        autoFocus={view === 'returned'}
                                        aria-label={t('More emoji…')}
                                        onClick={() => setView('full')}
                                    >
                                        <Plus aria-hidden />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {t('More emoji…')}
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
