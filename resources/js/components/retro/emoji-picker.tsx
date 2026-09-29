import {
    defaultEmojiDataResolver,
    EmojiPicker as Frimousse,
    type EmojiDataResolver,
} from 'frimousse';
import { useCallback, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { QuickEmoji } from '@/lib/retro/emoji';
import { useBoard } from './board-context';

type Props = {
    onPick: (emoji: string) => void;
    label: string;
    children: ReactNode;
};

export function EmojiPicker({ onPick, label, children }: Props) {
    const { t } = useTrans();
    const { board } = useBoard();
    const [browsing, setBrowsing] = useState(false);
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

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild aria-label={label}>
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="flex flex-wrap gap-1 p-1">
                    {QuickEmoji.map((emoji) => (
                        <DropdownMenuItem
                            key={emoji}
                            className="px-2 text-lg"
                            onSelect={() => onPick(emoji)}
                        >
                            {emoji}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="w-full" />
                    <DropdownMenuItem
                        className="w-full"
                        onSelect={() => setBrowsing(true)}
                    >
                        {t('More emoji…')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={browsing} onOpenChange={setBrowsing}>
                <DialogContent
                    aria-describedby={undefined}
                    className="max-w-sm"
                >
                    <DialogTitle>{label}</DialogTitle>
                    {unavailable && (
                        <p role="alert" className="text-sm text-destructive">
                            {t('Emoji list unavailable')}
                        </p>
                    )}
                    <Frimousse.Root
                        className="flex h-80 flex-col"
                        locale={board.emojiData.locale}
                        emojibaseUrl={board.emojiData.baseUrl}
                        resolveEmojiData={resolveEmojiData}
                        onEmojiSelect={({ emoji }) => {
                            setBrowsing(false);
                            onPick(emoji);
                        }}
                    >
                        <Frimousse.Search
                            className="mb-2 rounded-md border bg-background px-2 py-1 text-sm"
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
                                components={{
                                    CategoryHeader: ({
                                        category,
                                        ...props
                                    }) => (
                                        <div
                                            className="bg-background px-1 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                                            {...props}
                                        >
                                            {category.label}
                                        </div>
                                    ),
                                    Emoji: ({ emoji, ...props }) => (
                                        <button
                                            className="flex size-8 items-center justify-center rounded text-lg data-[active]:bg-accent"
                                            {...props}
                                        >
                                            {emoji.emoji}
                                        </button>
                                    ),
                                }}
                            />
                        </Frimousse.Viewport>
                    </Frimousse.Root>
                </DialogContent>
            </Dialog>
        </>
    );
}
