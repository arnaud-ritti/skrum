import { useTrans } from '@/hooks/use-trans';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { cn } from '@/lib/utils';

export type ReactionDrawerGridProps = {
    reactions: { emoji: string; count: number; mine: boolean }[];
    palette: string[];
    onReact: (emoji: string) => void;
    className?: string;
};

export type ReactionDrawerProps = Omit<ReactionDrawerGridProps, 'className'> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cardExcerpt: string;
    modal?: boolean;
    /** Element the drawer is rendered into; the page body by default. */
    container?: HTMLElement | null;
    className?: string;
};

/** The emoji grid of the drawer, without the drawer around it. */
export function ReactionDrawerGrid({
    reactions,
    palette,
    onReact,
    className,
}: ReactionDrawerGridProps) {
    const { t } = useTrans();
    const emojis = [
        ...palette,
        ...reactions
            .map((reaction) => reaction.emoji)
            .filter((emoji) => !palette.includes(emoji)),
    ];

    return (
        <div
            data-slot="reaction-drawer-grid"
            className={cn(
                'grid min-h-0 grid-cols-6 gap-1 overflow-y-auto py-2',
                className,
            )}
        >
            {emojis.map((emoji) => {
                const reaction = reactions.find((item) => item.emoji === emoji);
                const count = reaction?.count ?? 0;
                const mine = reaction?.mine ?? false;

                return (
                    <button
                        key={emoji}
                        type="button"
                        aria-pressed={mine}
                        aria-label={
                            count === 0
                                ? emoji
                                : count === 1
                                  ? t(':emoji, :count reaction', {
                                        emoji,
                                        count,
                                    })
                                  : t(':emoji, :count reactions', {
                                        emoji,
                                        count,
                                    })
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
    );
}

export function ReactionDrawer({
    open,
    onOpenChange,
    cardExcerpt,
    reactions,
    palette,
    onReact,
    modal,
    container,
    className,
}: ReactionDrawerProps) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(open);

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            modal={modal}
            container={container}
        >
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
                <ReactionDrawerGrid
                    reactions={reactions}
                    palette={palette}
                    onReact={onReact}
                />
            </DrawerContent>
        </Drawer>
    );
}
