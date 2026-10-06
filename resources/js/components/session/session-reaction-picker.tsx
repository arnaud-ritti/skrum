import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { EmojiPickerPanel } from '@/components/retro/emoji-picker';
import { Button } from '@/components/ui/button';
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
import type { EmojiDataLocation } from '@/lib/games/types';

type Props = {
    onPick: (emoji: string) => void;
    /** Where the full emoji list lives; defaults to the retro board's. */
    emojiData?: EmojiDataLocation;
};

/** The last button of the reactions bar: the full picker, above the bar. */
export function SessionReactionPicker({ onPick, emojiData }: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            data-roving
                            tabIndex={-1}
                            aria-label={t('More emoji…')}
                            className="size-11 shrink-0 rounded-full"
                        >
                            <SmilePlus className="size-5" aria-hidden />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('More emoji…')}</TooltipContent>
            </Tooltip>
            <PopoverContent
                side="top"
                aria-label={t('More emoji…')}
                className="max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
            >
                <EmojiPickerPanel
                    emojiData={emojiData}
                    onPick={(emoji) => {
                        setOpen(false);
                        onPick(emoji);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
