import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const Columns = 6;

export type ReactionPickerGridProps = {
    emojis: string[];
    /** Emoji the viewer already reacted with: shown pressed. */
    mine: string[];
    onToggle: (emoji: string) => void;
    /** Accessible name of the grid; "Reactions" by default. */
    label?: string;
    className?: string;
};

export type ReactionPickerProps = ReactionPickerGridProps & {
    /** The button that opens the picker (rendered as the popover trigger). */
    trigger: ReactNode;
    side?: 'top' | 'bottom';
    align?: 'start' | 'center' | 'end';
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
};

/** The six-column emoji grid of the picker, without the popover around it. */
export function ReactionPickerGrid({
    emojis,
    mine,
    onToggle,
    label,
    className,
}: ReactionPickerGridProps) {
    const { t } = useTrans();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const tabStop = Math.min(activeIndex, Math.max(emojis.length - 1, 0));

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        const last = emojis.length - 1;
        const targets: Record<string, number> = {
            ArrowRight: index >= last ? 0 : index + 1,
            ArrowLeft: index <= 0 ? last : index - 1,
            ArrowDown: index + Columns <= last ? index + Columns : index,
            ArrowUp: index - Columns >= 0 ? index - Columns : index,
            Home: 0,
            End: last,
        };

        if (!(event.key in targets)) {
            return;
        }

        event.preventDefault();

        const target = targets[event.key];

        setActiveIndex(target);
        buttons.current[target]?.focus();
    }

    return (
        <div
            role="group"
            aria-label={label ?? t('Reactions')}
            data-slot="reaction-picker-grid"
            className={cn(
                'grid max-h-64 grid-cols-6 gap-1 overflow-y-auto',
                className,
            )}
        >
            {emojis.map((emoji, index) => {
                const isMine = mine.includes(emoji);

                return (
                    <button
                        key={emoji}
                        ref={(node) => {
                            buttons.current[index] = node;
                        }}
                        type="button"
                        aria-label={emoji}
                        aria-pressed={isMine}
                        data-slot="reaction-picker-emoji"
                        data-state={isMine ? 'on' : 'off'}
                        tabIndex={index === tabStop ? 0 : -1}
                        onFocus={() => setActiveIndex(index)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        onClick={() => onToggle(emoji)}
                        className={cn(
                            'grid size-9 place-items-center rounded-md text-xl transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                            isMine
                                ? 'bg-skrum-primary-soft ring-1 ring-primary ring-inset'
                                : 'hover:bg-accent',
                        )}
                    >
                        <span aria-hidden>{emoji}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Emoji picker in a popover. It stays open after a toggle and through remote
 * updates of `mine`; Escape closes it and gives focus back to the trigger.
 */
export function ReactionPicker({
    trigger,
    side = 'top',
    align = 'center',
    open,
    defaultOpen,
    onOpenChange,
    label,
    className,
    ...grid
}: ReactionPickerProps) {
    const { t } = useTrans();

    return (
        <Popover
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
        >
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                side={side}
                align={align}
                aria-label={label ?? t('Reactions')}
                data-slot="reaction-picker"
                className={cn('p-2', className)}
            >
                <ReactionPickerGrid label={label} {...grid} />
            </PopoverContent>
        </Popover>
    );
}
