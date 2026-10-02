import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import type { Ref } from 'react';
import { ReactionPickerGrid } from '@/components/skrum/reaction-picker';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import { QuickEmoji } from '@/lib/retro/emoji';

type Props = {
    onPick: (emoji: string) => void;
    /** Opens the full emoji search; absent without an emoji list. */
    onMore?: () => void;
    triggerRef?: Ref<HTMLButtonElement>;
};

export function SessionReactionPicker({ onPick, onMore, triggerRef }: Props) {
    const { t } = useTrans();
    const [gridOpen, setGridOpen] = useState(false);

    function pick(emoji: string): void {
        onPick(emoji);
        setGridOpen(false);
    }

    return (
        <Popover open={gridOpen} onOpenChange={setGridOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    type="button"
                    size="icon"
                    variant="ghost"
                    data-roving
                    tabIndex={-1}
                    aria-label={t('Send a reaction')}
                    className="size-11 shrink-0 rounded-full"
                >
                    <SmilePlus className="size-5" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="flex flex-col gap-2 p-2">
                <ReactionPickerGrid
                    emojis={[...QuickEmoji]}
                    mine={[]}
                    onToggle={pick}
                    label={t('Send a reaction')}
                />
                {onMore && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setGridOpen(false);
                            onMore();
                        }}
                    >
                        <span className="truncate">{t('More emoji…')}</span>
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
}
