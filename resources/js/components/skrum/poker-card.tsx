import { useState } from 'react';
import type { CSSProperties, KeyboardEvent, Ref } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard } from '@/lib/poker/types';
import { singleKeyShortcutsEnabled } from '@/lib/shortcuts/preference';
import { cn } from '@/lib/utils';

const UnknownCard = '?';

export type PokerCardSize = 'sm' | 'md' | 'lg';

export type PokerCardProps = {
    value: string;
    unit?: string;
    faceDown?: boolean;
    selected?: boolean;
    disabled?: boolean;
    empty?: boolean;
    special?: boolean;
    size?: PokerCardSize;
    delay?: number;
    label?: string;
    radio?: boolean;
    tabIndex?: number;
    buttonRef?: Ref<HTMLButtonElement>;
    onSelect?: (value: string) => void;
    className?: string;
};

export type PokerDeckProps = {
    values: string[];
    value: string | null;
    onChange: (value: string) => void;
    onRetract?: () => void;
    unit?: string;
    size?: PokerCardSize;
    disabled?: boolean;
    disabledValues?: string[];
    /**
     * `toggle` (default) renders pressed buttons, the contract of the current
     * game page: pressing the selected card again withdraws the vote.
     * `radio` renders a radio group.
     */
    selection?: 'toggle' | 'radio';
    label?: string;
    /** Accessible name of a card; "Play :card" by default. */
    cardLabel?: (card: string) => string;
    className?: string;
};

const sizeClasses: Record<PokerCardSize, string> = {
    sm: 'h-15.5 w-11 rounded-md',
    md: 'h-23 w-16 rounded-xl',
    lg: 'h-34 w-24 rounded-xl',
};

const valueClassesBySize: Record<PokerCardSize, string[]> = {
    sm: ['text-xl', 'text-xl', 'text-sm', 'text-xs'],
    md: ['text-poker', 'text-poker', 'text-2xl', 'text-xl', 'text-base'],
    lg: ['text-poker', 'text-poker', 'text-4xl', 'text-3xl', 'text-2xl'],
};

const longValueClass: Record<PokerCardSize, string[]> = {
    sm: ['text-xs'],
    md: ['text-sm', 'text-xs', 'text-xs'],
    lg: ['text-xl', 'text-lg', 'text-lg'],
};

function valueClass(size: PokerCardSize, length: number): string {
    const classes = valueClassesBySize[size];

    if (length - 1 < classes.length) {
        return classes[Math.max(length - 1, 0)];
    }

    const longClasses = longValueClass[size];

    return longClasses[
        Math.min(length - classes.length, longClasses.length - 1)
    ];
}

function usePokerCardName() {
    const { t } = useTrans();

    return (value: string): string => {
        if (value === '?') {
            return t("I don't know");
        }

        if (value === '☕') {
            return t('Need a break');
        }

        return value;
    };
}

export function PokerCard({
    value,
    unit,
    faceDown = false,
    selected = false,
    disabled = false,
    empty = false,
    special,
    size = 'md',
    delay = 0,
    label,
    radio = false,
    tabIndex,
    buttonRef,
    onSelect,
    className,
}: PokerCardProps) {
    const { t } = useTrans();
    const cardName = usePokerCardName();
    const isSpecial = special ?? isSpecialCard(value);
    const isInteractive = onSelect !== undefined && !faceDown && !empty;
    const showsValue = !faceDown && !empty;
    const length = Array.from(value).length;
    const defaultName = (): string => {
        if (faceDown) {
            return t('Face-down card');
        }

        if (empty) {
            return t('No vote');
        }

        if (isInteractive) {
            return t('Play :card', { card: value });
        }

        return unit ? `${cardName(value)} ${unit}` : cardName(value);
    };
    const name = label ?? defaultName();
    const showsCorner =
        showsValue && !isSpecial && size !== 'sm' && length <= 3;
    const showsUnit = showsValue && unit !== undefined && size !== 'sm';
    const flipStyle: CSSProperties = {
        transitionDelay: faceDown ? '0ms' : `${Math.max(delay, 0)}ms`,
    };
    const rootClassName = cn(
        'relative block shrink-0 transition-transform duration-220 ease-spring outline-none perspective-midrange motion-reduce:transition-none',
        sizeClasses[size],
        selected && '-translate-y-2.5',
        isInteractive &&
            !disabled &&
            !selected &&
            'cursor-pointer hover:-translate-y-1',
        isInteractive &&
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        disabled && 'opacity-40',
        disabled && isInteractive && 'cursor-not-allowed',
        className,
    );

    const body = (
        <span
            data-slot="poker-card-flip"
            className="flip-3d relative block size-full motion-reduce:transform-none!"
            style={{
                ...flipStyle,
                transform: faceDown ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
        >
            <span
                data-slot="poker-card-face"
                className={cn(
                    'absolute inset-0 grid place-items-center overflow-hidden rounded-[inherit] border-2 px-1 font-display transition-opacity duration-140 backface-hidden motion-reduce:backface-visible',
                    faceDown && 'motion-reduce:opacity-0',
                    empty
                        ? 'border-dashed border-input bg-transparent'
                        : 'border-border bg-card text-foreground shadow-card',
                    isSpecial && !empty && 'bg-muted text-muted-foreground',
                    selected &&
                        'border-primary bg-skrum-primary-soft text-skrum-primary-text shadow-raised ring-2 ring-primary',
                )}
            >
                {showsValue && (
                    <>
                        {showsCorner && (
                            <small
                                data-slot="poker-card-corner"
                                className="absolute top-1.5 left-2 max-w-full truncate font-sans text-xs font-bold tracking-normal text-muted-foreground"
                            >
                                {value}
                            </small>
                        )}
                        <span
                            data-slot="poker-card-value"
                            className={cn(
                                'max-w-full truncate leading-none font-bold tracking-tight',
                                valueClass(size, length),
                            )}
                        >
                            {value}
                        </span>
                        {showsUnit && (
                            <span
                                data-slot="poker-card-unit"
                                className="absolute inset-x-1 bottom-1.5 truncate text-center font-sans text-xs font-medium text-muted-foreground"
                            >
                                {unit}
                            </span>
                        )}
                    </>
                )}
            </span>
            <span
                data-slot="poker-card-back"
                aria-hidden
                className={cn(
                    'absolute inset-0 rounded-[inherit] border-2 border-primary bg-primary shadow-card transition-opacity duration-140 backface-hidden motion-reduce:transform-none! motion-reduce:backface-visible',
                    !faceDown && 'motion-reduce:opacity-0',
                )}
                style={{
                    transform: 'rotateY(180deg)',
                    backgroundImage:
                        'radial-gradient(var(--primary-foreground) 1.6px, transparent 1.8px)',
                    backgroundSize: '0.625rem 0.625rem',
                }}
            >
                <span
                    className={cn(
                        'absolute border-2 border-primary-foreground/70',
                        size === 'sm'
                            ? 'inset-1 rounded-sm'
                            : 'inset-1.75 rounded-lg',
                    )}
                />
            </span>
        </span>
    );

    const dataAttributes = {
        'data-slot': 'poker-card',
        'data-face': empty ? 'empty' : faceDown ? 'down' : 'up',
        'data-size': size,
    };

    if (isInteractive) {
        return (
            <button
                {...dataAttributes}
                ref={buttonRef}
                type="button"
                role={radio ? 'radio' : undefined}
                aria-checked={radio ? selected : undefined}
                aria-pressed={radio ? undefined : selected}
                aria-label={name}
                disabled={disabled}
                tabIndex={tabIndex}
                onClick={() => onSelect(value)}
                className={rootClassName}
            >
                {body}
            </button>
        );
    }

    return (
        <span
            {...dataAttributes}
            role="img"
            aria-label={name}
            aria-disabled={disabled || undefined}
            className={rootClassName}
        >
            {body}
        </span>
    );
}

export function PokerDeck({
    values,
    value,
    onChange,
    onRetract,
    unit,
    size = 'md',
    disabled = false,
    disabledValues = [],
    selection = 'toggle',
    label,
    cardLabel,
    className,
}: PokerDeckProps) {
    const { t } = useTrans();
    const [focusedValue, setFocusedValue] = useState<string | null>(null);
    const buttons = new Map<string, HTMLButtonElement>();
    const isDisabled = (card: string): boolean =>
        disabled || disabledValues.includes(card);
    const enabledValues = values.filter((card) => !isDisabled(card));
    const tabStop =
        [focusedValue, value].find(
            (card) => card !== null && enabledValues.includes(card),
        ) ?? enabledValues[0];

    function focusCard(card: string): void {
        setFocusedValue(card);
        buttons.get(card)?.focus();
    }

    function select(card: string): void {
        setFocusedValue(card);

        if (
            selection === 'toggle' &&
            card === value &&
            onRetract !== undefined
        ) {
            onRetract();

            return;
        }

        onChange(card);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key === 'Escape') {
            if (value === null || onRetract === undefined || disabled) {
                return;
            }

            event.preventDefault();
            onRetract();

            return;
        }

        if (
            event.key === UnknownCard &&
            enabledValues.includes(UnknownCard) &&
            singleKeyShortcutsEnabled()
        ) {
            // The deck owns "?" while it has that card to play: the help
            // dialog, on the same key, must not open as well.
            event.preventDefault();
            buttons.get(UnknownCard)?.focus();
            select(UnknownCard);

            return;
        }

        if (/^[0-9]$/.test(event.key) && singleKeyShortcutsEnabled()) {
            // The deck owns the digits while it has focus: page shortcuts on
            // the same keys (quick reactions) must not fire as well.
            event.preventDefault();

            if (!enabledValues.includes(event.key)) {
                return;
            }

            buttons.get(event.key)?.focus();
            select(event.key);

            return;
        }

        const focusedCard = Array.from(buttons.entries()).find(
            ([, button]) => button === document.activeElement,
        )?.[0];
        const current = enabledValues.indexOf(focusedCard ?? '');
        const lastIndex = enabledValues.length - 1;
        const targets: Record<string, number> = {
            ArrowRight: current >= lastIndex ? 0 : current + 1,
            ArrowDown: current >= lastIndex ? 0 : current + 1,
            ArrowLeft: current <= 0 ? lastIndex : current - 1,
            ArrowUp: current <= 0 ? lastIndex : current - 1,
            Home: 0,
            End: lastIndex,
        };

        if (!(event.key in targets) || enabledValues.length === 0) {
            return;
        }

        event.preventDefault();
        focusCard(enabledValues[targets[event.key]]);
    }

    return (
        <div
            role={selection === 'radio' ? 'radiogroup' : 'group'}
            aria-label={label ?? t('Your cards')}
            data-slot="poker-deck"
            onKeyDown={handleKeyDown}
            className={cn(
                'flex flex-wrap items-end justify-center gap-2 px-2 pt-4 pb-2',
                className,
            )}
        >
            {values.map((card) => (
                <PokerCard
                    key={card}
                    value={card}
                    unit={unit}
                    size={size}
                    label={cardLabel?.(card)}
                    radio={selection === 'radio'}
                    selected={value === card}
                    disabled={isDisabled(card)}
                    tabIndex={card === tabStop ? 0 : -1}
                    buttonRef={(element) => {
                        if (element) {
                            buttons.set(card, element);
                        }
                    }}
                    onSelect={select}
                />
            ))}
        </div>
    );
}
