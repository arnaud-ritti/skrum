import {
    defaultEmojiDataResolver,
    EmojiPicker as Frimousse,
    type EmojiDataResolver,
    type EmojiPickerListCategoryHeaderProps,
    type EmojiPickerListComponents,
    type EmojiPickerListEmojiProps,
} from 'frimousse';
import { Search } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { EmojiDataLocation } from '@/lib/games/types';
import { QuickEmoji } from '@/lib/retro/emoji';
import { useOptionalBoard } from './board-context';
import { dragIsolation } from './dnd';

type Props = {
    onPick: (emoji: string) => void;
    label: string;
    children: ReactNode;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

function CategoryHeader({
    category,
    ...props
}: EmojiPickerListCategoryHeaderProps) {
    return (
        <div
            className="bg-popover px-1 pt-2 pb-1 text-overline text-muted-foreground"
            {...props}
        >
            {category.label}
        </div>
    );
}

function Emoji({ emoji, ...props }: EmojiPickerListEmojiProps) {
    return (
        <button
            className="grid size-9 place-items-center rounded-md text-xl outline-none data-[active]:bg-accent"
            {...props}
        >
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

type EmojiSearchDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label: string;
    onPick: (emoji: string) => void;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
    /** Where focus goes on close, when the opener is no longer mounted. */
    onCloseAutoFocus?: (event: Event) => void;
};

/** The full emoji set, searchable. Renders nothing without an emoji list. */
export function EmojiSearchDialog({
    open,
    onOpenChange,
    label,
    onPick,
    emojiData,
    onCloseAutoFocus,
}: EmojiSearchDialogProps) {
    const { t } = useTrans();
    const data = useEmojiData(emojiData);
    const [unavailable, setUnavailable] = useState(false);

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...dragIsolation}
                size="sm"
                aria-describedby={undefined}
                onCloseAutoFocus={onCloseAutoFocus}
            >
                <DialogTitle>{label}</DialogTitle>
                {unavailable && (
                    <p
                        role="alert"
                        className="text-body-sm text-skrum-destructive-text"
                    >
                        {t('Emoji list unavailable')}
                    </p>
                )}
                <Frimousse.Root
                    className="flex h-80 flex-col"
                    locale={data.locale}
                    emojibaseUrl={data.baseUrl}
                    resolveEmojiData={resolveEmojiData}
                    onEmojiSelect={({ emoji }) => {
                        onOpenChange(false);
                        onPick(emoji);
                    }}
                >
                    <Frimousse.Search
                        className="mb-2 h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={t('Search emoji…')}
                        aria-label={t('Search emoji…')}
                    />
                    <Frimousse.Viewport className="relative flex-1">
                        {!unavailable && (
                            <Frimousse.Loading className="p-2 text-sm text-muted-foreground">
                                {t('Loading…')}
                            </Frimousse.Loading>
                        )}
                        <Frimousse.Empty className="p-2 text-sm text-muted-foreground">
                            {t('No emoji found.')}
                        </Frimousse.Empty>
                        <Frimousse.List
                            className="select-none"
                            components={ListComponents}
                        />
                    </Frimousse.Viewport>
                </Frimousse.Root>
            </DialogContent>
        </Dialog>
    );
}

export function EmojiPicker({ onPick, label, children, emojiData }: Props) {
    const { t } = useTrans();
    const data = useEmojiData(emojiData);
    const [browsing, setBrowsing] = useState(false);
    // The search opens from an entry of the menu, gone once it closes: the
    // focus goes back to the button of the menu instead.
    const trigger = useRef<HTMLButtonElement>(null);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger ref={trigger} asChild aria-label={label}>
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    {...dragIsolation}
                    data-slot="emoji-quick-list"
                    className="grid grid-cols-6 gap-1 p-2"
                >
                    {QuickEmoji.map((emoji) => (
                        <DropdownMenuItem
                            key={emoji}
                            className="size-9 justify-center rounded-md p-0 text-xl"
                            onSelect={() => onPick(emoji)}
                        >
                            {emoji}
                        </DropdownMenuItem>
                    ))}
                    {data !== null && (
                        <>
                            <DropdownMenuSeparator className="col-span-full" />
                            <DropdownMenuItem
                                className="col-span-full"
                                onSelect={() => setBrowsing(true)}
                            >
                                <Search aria-hidden />
                                <span className="truncate">
                                    {t('More emoji…')}
                                </span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <EmojiSearchDialog
                open={browsing}
                onOpenChange={setBrowsing}
                label={label}
                onPick={onPick}
                emojiData={emojiData}
                onCloseAutoFocus={(event) => {
                    if (trigger.current?.isConnected) {
                        event.preventDefault();
                        trigger.current.focus();
                    }
                }}
            />
        </>
    );
}
