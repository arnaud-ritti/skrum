import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { PostItColors } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { cn } from '@/lib/utils';

export type WhiteboardColorBarProps = {
    value: PostItColor;
    onChange: (color: PostItColor) => void;
    orientation?: 'horizontal' | 'vertical';
    disabled?: boolean;
    className?: string;
};

const swatchClasses: Record<PostItColor, string> = {
    sun: 'bg-skrum-col-sun border-skrum-col-sun-border',
    apricot: 'bg-skrum-col-apricot border-skrum-col-apricot-border',
    coral: 'bg-skrum-col-coral border-skrum-col-coral-border',
    plum: 'bg-skrum-col-plum border-skrum-col-plum-border',
    iris: 'bg-skrum-col-iris border-skrum-col-iris-border',
    sky: 'bg-skrum-col-sky border-skrum-col-sky-border',
    lagoon: 'bg-skrum-col-lagoon border-skrum-col-lagoon-border',
    moss: 'bg-skrum-col-moss border-skrum-col-moss-border',
};

export function useColorNames(): Record<PostItColor, string> {
    const { t } = useTrans();

    return {
        sun: t('Sun'),
        apricot: t('Apricot'),
        coral: t('Coral'),
        plum: t('Plum'),
        iris: t('Iris'),
        sky: t('Sky'),
        lagoon: t('Lagoon'),
        moss: t('Moss'),
    };
}

export function WhiteboardColorBar({
    value,
    onChange,
    orientation = 'horizontal',
    disabled = false,
    className,
}: WhiteboardColorBarProps) {
    const { t } = useTrans();
    const names = useColorNames();
    const refs = useRef<Partial<Record<PostItColor, HTMLButtonElement | null>>>(
        {},
    );
    const isVertical = orientation === 'vertical';

    const move = (event: KeyboardEvent<HTMLButtonElement>): void => {
        const forwardKey = isVertical ? 'ArrowDown' : 'ArrowRight';
        const backwardKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
        const last = PostItColors.length - 1;
        const index = PostItColors.indexOf(value);
        let next: number | null = null;

        if (event.key === forwardKey || event.key === 'ArrowDown') {
            next = index >= last ? 0 : index + 1;
        }

        if (event.key === backwardKey || event.key === 'ArrowUp') {
            next = index <= 0 ? last : index - 1;
        }

        if (event.key === 'Home') {
            next = 0;
        }

        if (event.key === 'End') {
            next = last;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        const color = PostItColors[next];
        onChange(color);
        refs.current[color]?.focus();
    };

    return (
        <div
            data-slot="whiteboard-color-bar"
            role="radiogroup"
            aria-label={t('Fill colour')}
            aria-orientation={orientation}
            className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-xl border border-border bg-popover p-1 shadow-raised',
                isVertical ? 'flex-col' : 'flex-wrap',
                disabled && 'opacity-50',
                className,
            )}
        >
            {PostItColors.map((color) => {
                const isActive = color === value;

                return (
                    <button
                        key={color}
                        ref={(node) => {
                            refs.current[color] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={names[color]}
                        title={names[color]}
                        disabled={disabled}
                        tabIndex={isActive ? 0 : -1}
                        data-color={color}
                        onClick={() => onChange(color)}
                        onKeyDown={move}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover disabled:pointer-events-none"
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'size-6 rounded-full border-2',
                                swatchClasses[color],
                                isActive &&
                                    'ring-2 ring-primary ring-offset-2 ring-offset-popover',
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}
