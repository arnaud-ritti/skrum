import { useTrans } from '@/hooks/use-trans';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useRestoreFocus } from '@/components/skrum/vote-drawer';
import { cn } from '@/lib/utils';

export type ReactionDrawerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cardExcerpt: string;
    reactions: { emoji: string; count: number; mine: boolean }[];
    palette: string[];
    onReact: (emoji: string) => void;
    modal?: boolean;
    className?: string;
};

export function ReactionDrawer({
    open,
    onOpenChange,
    cardExcerpt,
    reactions,
    palette,
    onReact,
    modal,
    className,
}: ReactionDrawerProps) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(open);
    const emojis = [
        ...palette,
        ...reactions
            .map((reaction) => reaction.emoji)
            .filter((emoji) => !palette.includes(emoji)),
    ];

    return (
        <Drawer open={open} onOpenChange={onOpenChange} modal={modal}>
            <DrawerContent
                closeLabel={t('Close')}
                onCloseAutoFocus={restoreFocus}
                className={className}
            >
                <DrawerHeader>
                    <DrawerTitle>{t('React to this card')}</DrawerTitle>
                    <DrawerDescription className="line-clamp-2 break-words">
                        {cardExcerpt}
                    </DrawerDescription>
                </DrawerHeader>
                <div
                    data-slot="reaction-drawer-grid"
                    className="grid min-h-0 grid-cols-6 gap-1 overflow-y-auto py-2"
                >
                    {emojis.map((emoji) => {
                        const reaction = reactions.find(
                            (item) => item.emoji === emoji,
                        );
                        const count = reaction?.count ?? 0;
                        const mine = reaction?.mine ?? false;

                        return (
                            <button
                                key={emoji}
                                type="button"
                                aria-pressed={mine}
                                aria-label={
                                    count > 0
                                        ? t(':emoji, :count reactions', {
                                              emoji,
                                              count,
                                          })
                                        : emoji
                                }
                                data-slot="reaction-drawer-emoji"
                                data-state={mine ? 'on' : undefined}
                                onClick={() => onReact(emoji)}
                                className={cn(
                                    'relative flex size-11 items-center justify-center justify-self-center rounded-lg border text-2xl transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                    mine
                                        ? 'border-primary bg-skrum-primary-soft'
                                        : 'border-transparent hover:bg-accent',
                                )}
                            >
                                <span aria-hidden>{emoji}</span>
                                {count > 0 && (
                                    <span
                                        aria-hidden
                                        className="absolute -right-1 -bottom-1 min-w-4 truncate rounded-full bg-card px-1 text-center text-xs font-semibold text-skrum-primary-text shadow-card"
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
