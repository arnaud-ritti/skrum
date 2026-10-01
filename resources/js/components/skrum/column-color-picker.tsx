import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type ColumnColor =
    | 'sun'
    | 'apricot'
    | 'coral'
    | 'plum'
    | 'iris'
    | 'sky'
    | 'lagoon'
    | 'moss';

export const columnColors: ColumnColor[] = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
];

export const columnColorClasses: Record<
    ColumnColor,
    { swatch: string; dot: string }
> = {
    sun: {
        swatch: 'bg-skrum-col-sun-border ring-skrum-col-sun-text',
        dot: 'bg-skrum-col-sun-border',
    },
    apricot: {
        swatch: 'bg-skrum-col-apricot-border ring-skrum-col-apricot-text',
        dot: 'bg-skrum-col-apricot-border',
    },
    coral: {
        swatch: 'bg-skrum-col-coral-border ring-skrum-col-coral-text',
        dot: 'bg-skrum-col-coral-border',
    },
    plum: {
        swatch: 'bg-skrum-col-plum-border ring-skrum-col-plum-text',
        dot: 'bg-skrum-col-plum-border',
    },
    iris: {
        swatch: 'bg-skrum-col-iris-border ring-skrum-col-iris-text',
        dot: 'bg-skrum-col-iris-border',
    },
    sky: {
        swatch: 'bg-skrum-col-sky-border ring-skrum-col-sky-text',
        dot: 'bg-skrum-col-sky-border',
    },
    lagoon: {
        swatch: 'bg-skrum-col-lagoon-border ring-skrum-col-lagoon-text',
        dot: 'bg-skrum-col-lagoon-border',
    },
    moss: {
        swatch: 'bg-skrum-col-moss-border ring-skrum-col-moss-text',
        dot: 'bg-skrum-col-moss-border',
    },
};

export function useColumnColorName(): (color: ColumnColor) => string {
    const { t } = useTrans();

    return (color) => {
        const names: Record<ColumnColor, string> = {
            sun: t('Sun'),
            apricot: t('Apricot'),
            coral: t('Coral'),
            plum: t('Plum'),
            iris: t('Iris'),
            sky: t('Sky'),
            lagoon: t('Lagoon'),
            moss: t('Moss'),
        };

        return names[color];
    };
}

export function ColorSwatch({
    color,
    className,
}: {
    color: ColumnColor;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            data-slot="color-swatch"
            data-color={color}
            className={cn(
                'inline-block size-4.5 shrink-0 rounded-full ring-1 ring-inset',
                columnColorClasses[color].swatch,
                className,
            )}
        />
    );
}

export type ColumnColorPickerProps = {
    value: ColumnColor;
    onValueChange: (color: ColumnColor) => void;
    usedBy?: Partial<Record<ColumnColor, string>>;
    columnTitle: string;
    defaultOpen?: boolean;
    className?: string;
};

export function ColumnColorPicker({
    value,
    onValueChange,
    usedBy = {},
    columnTitle,
    defaultOpen = false,
    className,
}: ColumnColorPickerProps) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const [open, setOpen] = useState(defaultOpen);
    const optionRefs = useRef<Partial<Record<ColumnColor, HTMLButtonElement>>>(
        {},
    );
    const anyUsed = columnColors.some((color) => usedBy[color] !== undefined);
    const displayTitle =
        columnTitle.trim() === '' ? t('Untitled') : columnTitle;

    const commit = (color: ColumnColor) => {
        onValueChange(color);
        setOpen(false);
    };

    const moveFocus = (from: ColumnColor, step: number) => {
        const index = columnColors.indexOf(from);
        const next =
            columnColors[
                (index + step + columnColors.length) % columnColors.length
            ];

        optionRefs.current[next]?.focus();
    };

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        color: ColumnColor,
    ) => {
        const steps: Record<string, number> = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
        };

        if (event.key in steps) {
            event.preventDefault();
            moveFocus(color, steps[event.key]);

            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            optionRefs.current[columnColors[0]]?.focus();

            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            optionRefs.current[columnColors[columnColors.length - 1]]?.focus();
        }
    };

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    data-slot="column-color-trigger"
                    aria-label={t('Color: :color', {
                        color: colorName(value),
                    })}
                    className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md border border-input bg-card transition-[box-shadow] duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        'data-[state=open]:ring-2 data-[state=open]:ring-ring',
                        className,
                    )}
                >
                    <ColorSwatch color={value} />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={6}
                    data-slot="column-color-picker"
                    className="@container/cpick z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-popover outline-none"
                >
                    <p className="mb-2 truncate text-sm font-semibold">
                        {t('Color of “:title”', { title: displayTitle })}
                    </p>
                    <div
                        role="radiogroup"
                        aria-label={t('Color of “:title”', {
                            title: displayTitle,
                        })}
                        className="grid grid-cols-4 gap-1 @sm/cpick:grid-cols-8"
                    >
                        {columnColors.map((color) => {
                            const taken = usedBy[color];
                            const checked = color === value;
                            const name = colorName(color);

                            return (
                                <button
                                    key={color}
                                    ref={(node) => {
                                        if (node === null) {
                                            delete optionRefs.current[color];

                                            return;
                                        }

                                        optionRefs.current[color] = node;
                                    }}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    aria-label={
                                        taken === undefined
                                            ? name
                                            : t(':color, used by :title', {
                                                  color: name,
                                                  title: taken,
                                              })
                                    }
                                    tabIndex={checked ? 0 : -1}
                                    data-state={
                                        checked ? 'checked' : 'unchecked'
                                    }
                                    data-color={color}
                                    onClick={() => commit(color)}
                                    onKeyDown={(event) =>
                                        handleKeyDown(event, color)
                                    }
                                    className="flex min-w-0 flex-col items-center gap-1 rounded-sm p-1 text-overline text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:text-foreground"
                                >
                                    <span
                                        className={cn(
                                            'relative grid size-7 place-items-center rounded-full',
                                            columnColorClasses[color].dot,
                                            checked &&
                                                'ring-2 ring-ring ring-offset-2 ring-offset-popover',
                                        )}
                                    >
                                        {taken !== undefined && (
                                            <span
                                                aria-hidden="true"
                                                data-slot="used-dot"
                                                className="size-1.5 rounded-full bg-foreground"
                                            />
                                        )}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="max-w-full truncate"
                                    >
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {anyUsed && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                                aria-hidden="true"
                                className="size-1.5 shrink-0 rounded-full bg-foreground"
                            />
                            <span>
                                {t(
                                    'Used by another column. Pick it to swap colors.',
                                )}
                            </span>
                        </p>
                    )}
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
