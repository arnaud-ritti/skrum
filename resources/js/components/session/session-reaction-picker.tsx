import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import {
    EmojiSearchDialog,
    useEmojiData,
} from '@/components/retro/emoji-picker';
import { ReactionPickerGrid } from '@/components/skrum/reaction-picker';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import type { EmojiDataLocation } from '@/lib/games/types';
import { QuickEmoji } from '@/lib/retro/emoji';

type Props = {
    onPick: (emoji: string) => void;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

export function SessionReactionPicker({ onPick, emojiData }: Props) {
    const { t } = useTrans();
    const hasFullList = useEmojiData(emojiData) !== null;
    const [gridOpen, setGridOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    function pick(emoji: string): void {
        onPick(emoji);
        setGridOpen(false);
        setSearchOpen(false);
    }

    return (
        <>
            <Popover open={gridOpen} onOpenChange={setGridOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('Send a reaction')}
                    >
                        <SmilePlus aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="flex flex-col gap-2 p-2">
                    <ReactionPickerGrid
                        emojis={[...QuickEmoji]}
                        mine={[]}
                        onToggle={pick}
                        label={t('Send a reaction')}
                    />
                    {hasFullList && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setGridOpen(false);
                                setSearchOpen(true);
                            }}
                        >
                            <span className="truncate">{t('More emoji…')}</span>
                        </Button>
                    )}
                </PopoverContent>
            </Popover>
            <EmojiSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                label={t('Send a reaction')}
                onPick={pick}
                emojiData={emojiData}
            />
        </>
    );
}
