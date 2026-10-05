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
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export type { ColumnColor };

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

        return names[color] ?? color;
    };
}

function ColorSwatch({
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
                'inline-block size-4.5 shrink-0 rounded-full bg-(--col-border) ring-1 ring-(--col-text) ring-inset',
                columnColorClass(color),
                className,
            )}
        />
    );
}

export type ColumnColorOptionsProps<C extends ColumnColor = ColumnColor> = {
    value: C;
    onValueChange: (color: C) => void;
    colors?: readonly C[];
    usedBy?: Partial<Record<C, string>>;
    columnTitle: string;
    /**
     * `tooltip`: swatches alone on the line of the title; the colour name is
     * the tooltip and the accessible name of each swatch.
     */
    labels?: 'visible' | 'tooltip';
};

export function ColumnColorOptions<C extends ColumnColor = ColumnColor>({
    value,
    onValueChange,
    colors = columnColors as readonly ColumnColor[] as readonly C[],
    usedBy = {},
    columnTitle,
    labels = 'visible',
}: ColumnColorOptionsProps<C>) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const optionRefs = useRef(new Map<ColumnColor, HTMLButtonElement>());
    const anyUsed = colors.some((color) => usedBy[color] !== undefined);
    const tabStop = colors.includes(value) ? value : colors[0];
    const displayTitle =
        columnTitle.trim() === '' ? t('Untitled') : columnTitle;

    const moveFocus = (from: C, step: number) => {
        const index = colors.indexOf(from);
        const next = colors[(index + step + colors.length) % colors.length];

        optionRefs.current.get(next)?.focus();
    };

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        color: C,
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
            optionRefs.current.get(colors[0])?.focus();

            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            optionRefs.current.get(colors[colors.length - 1])?.focus();
        }
    };

    const swatchesOnly = labels === 'tooltip';
    const groupLabel = t('Colour of “:title”', { title: displayTitle });

    const option = (color: C) => {
        const taken = usedBy[color];
        const checked = color === value;
        const name = colorName(color);
        const accessibleName =
            taken === undefined
                ? name
                : t(':color, used by :title', { color: name, title: taken });
        const usedDot = taken !== undefined && (
            <span
                aria-hidden="true"
                data-slot="used-dot"
                className="size-1.5 rounded-full bg-foreground"
            />
        );
        const shared = {
            ref: (node: HTMLButtonElement | null) => {
                if (node === null) {
                    optionRefs.current.delete(color);

                    return;
                }

                optionRefs.current.set(color, node);
            },
            type: 'button' as const,
            role: 'radio',
            'aria-checked': checked,
            'aria-label': accessibleName,
            tabIndex: color === tabStop ? 0 : -1,
            'data-state': checked ? 'checked' : 'unchecked',
            'data-color': color,
            onClick: () => onValueChange(color),
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
                handleKeyDown(event, color),
        };

        if (swatchesOnly) {
            return (
                <Tooltip key={color}>
                    <TooltipTrigger asChild>
                        <button
                            {...shared}
                            className="grid size-7 shrink-0 place-items-center rounded-full outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <span
                                className={cn(
                                    'grid size-5.5 place-items-center rounded-full bg-(--col-border) inset-ring inset-ring-(--col-text)',
                                    columnColorClass(color),
                                    checked &&
                                        'ring-2 ring-ring ring-offset-2 ring-offset-popover',
                                )}
                            >
                                {usedDot}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{accessibleName}</TooltipContent>
                </Tooltip>
            );
        }

        return (
            <button
                key={color}
                {...shared}
                className="flex min-w-0 flex-col items-center gap-1 rounded-sm p-1 text-overline text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:text-foreground"
            >
                <span
                    className={cn(
                        'relative grid size-7 place-items-center rounded-full bg-(--col-border)',
                        columnColorClass(color),
                        checked &&
                            'ring-2 ring-ring ring-offset-2 ring-offset-popover',
                    )}
                >
                    {usedDot}
                </span>
                <span aria-hidden="true" className="max-w-full truncate">
                    {name}
                </span>
            </button>
        );
    };

    return (
        <div
            data-slot="column-color-options"
            data-labels={labels}
            className="@container/cpick"
        >
            {swatchesOnly ? (
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="max-w-full truncate text-xs text-muted-foreground">
                        {groupLabel}
                    </p>
                    <div
                        role="radiogroup"
                        aria-label={groupLabel}
                        className="flex min-w-0 flex-wrap items-center gap-0.5"
                    >
                        {colors.map(option)}
                    </div>
                </div>
            ) : (
                <>
                    <p className="mb-2 truncate text-sm font-semibold">
                        {groupLabel}
                    </p>
                    <div
                        role="radiogroup"
                        aria-label={groupLabel}
                        className="grid grid-cols-4 gap-1 @sm/cpick:grid-cols-8"
                    >
                        {colors.map(option)}
                    </div>
                </>
            )}
            {anyUsed && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-foreground"
                    />
                    <span>
                        {t('Used by another column. Pick it to swap colours.')}
                    </span>
                </p>
            )}
        </div>
    );
}

export type ColumnColorPickerProps<C extends ColumnColor = ColumnColor> =
    ColumnColorOptionsProps<C> & {
        defaultOpen?: boolean;
        className?: string;
        'aria-invalid'?: boolean;
        'aria-describedby'?: string;
    };

export function ColumnColorPicker<C extends ColumnColor = ColumnColor>({
    value,
    onValueChange,
    colors,
    usedBy,
    columnTitle,
    defaultOpen = false,
    className,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
}: ColumnColorPickerProps<C>) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-slot="column-color-trigger"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    aria-label={t('Colour: :color', {
                        color: colorName(value),
                    })}
                    className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md border border-input bg-card transition-[box-shadow] duration-140 ease-standard outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        className,
                    )}
                >
                    <ColorSwatch color={value} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                data-slot="column-color-picker"
                className="w-72 max-w-viewport-gutter p-3"
            >
                <ColumnColorOptions
                    value={value}
                    onValueChange={(color) => {
                        onValueChange(color);
                        setOpen(false);
                    }}
                    colors={colors}
                    usedBy={usedBy}
                    columnTitle={columnTitle}
                />
            </PopoverContent>
        </Popover>
    );
}
