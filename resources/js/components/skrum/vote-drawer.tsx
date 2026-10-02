import { Check, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type VoteDrawerPanelProps = {
    deck: (string | number)[];
    value?: string | null;
    disabledValues?: string[];
    onVote: (value: string) => void;
    onRetract?: () => void;
    className?: string;
};

export type VoteDrawerProps = VoteDrawerPanelProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    revealed?: boolean;
    description?: string;
    modal?: boolean;
    /** Element the drawer is rendered into; the page body by default. */
    container?: HTMLElement | null;
};

function isNumeric(value: string): boolean {
    return value.trim() !== '' && Number.isFinite(Number(value));
}

/**
 * The deck and its actions, without the drawer around them. It starts from
 * `value` when it mounts, which is each time the drawer opens.
 */
export function VoteDrawerPanel({
    deck,
    value = null,
    disabledValues = [],
    onVote,
    onRetract,
    className,
}: VoteDrawerPanelProps) {
    const { t } = useTrans();
    const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [picked, setPicked] = useState<string | null>(value);
    const values = deck.map(String);

    function labelFor(card: string): string {
        if (card === '?') {
            return t('Not sure');
        }

        if (card === '☕') {
            return t('Coffee break');
        }

        if (!isNumeric(card)) {
            return card;
        }

        return Number(card) === 1
            ? t(':value point', { value: card })
            : t(':value points', { value: card });
    }

    function confirmLabel(card: string): string {
        if (!isNumeric(card)) {
            return t('Validate :value', { value: labelFor(card) });
        }

        return Number(card) === 1
            ? t('Validate :value point', { value: card })
            : t('Validate :value points', { value: card });
    }

    function isAvailable(card: string): boolean {
        return !disabledValues.includes(card);
    }

    function move(from: number, step: number): void {
        for (let offset = 1; offset <= values.length; offset += 1) {
            const index =
                (from + step * offset + values.length * offset) % values.length;
            const card = values[index];

            if (isAvailable(card)) {
                setPicked(card);
                cardRefs.current[index]?.focus();

                return;
            }
        }
    }

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            move(index, 1);
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            move(index, -1);
        }
    }

    const tabbableCard =
        picked !== null && values.includes(picked) && isAvailable(picked)
            ? picked
            : values.find(isAvailable);

    return (
        <div
            data-slot="vote-drawer-panel"
            className={cn('flex min-h-0 flex-col', className)}
        >
            <div
                role="radiogroup"
                aria-label={t('Cards')}
                data-slot="vote-drawer-deck"
                className="grid min-h-0 grid-cols-4 justify-items-center gap-2 overflow-y-auto px-1 py-3 sm:grid-cols-5"
            >
                {values.map((card, index) => {
                    const selected = card === picked;
                    const available = isAvailable(card);
                    const special = !isNumeric(card);

                    return (
                        <button
                            key={`${card}-${index}`}
                            ref={(node) => {
                                cardRefs.current[index] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={labelFor(card)}
                            data-slot="vote-drawer-card"
                            data-state={selected ? 'selected' : undefined}
                            data-special={special || undefined}
                            disabled={!available}
                            tabIndex={card === tabbableCard ? 0 : -1}
                            onClick={() => setPicked(card)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={cn(
                                'flex h-24 w-full max-w-18 min-w-11 items-center justify-center rounded-lg border px-1 font-semibold transition-all duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                Array.from(card).length > 3
                                    ? 'text-xs'
                                    : 'text-xl',
                                special
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-card text-foreground shadow-card',
                                'border-border',
                                selected &&
                                    '-translate-y-2.5 border-transparent bg-skrum-primary-soft text-skrum-primary-text ring-2 ring-primary',
                                !available && 'cursor-not-allowed opacity-40',
                            )}
                        >
                            <span className="truncate">{card}</span>
                        </button>
                    );
                })}
            </div>
            <DrawerFooter>
                <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full min-w-0"
                    disabled={picked === null}
                    onClick={() => {
                        if (picked !== null) {
                            onVote(picked);
                        }
                    }}
                >
                    <Check aria-hidden />
                    <span className="truncate">
                        {picked === null
                            ? t('Validate my vote')
                            : confirmLabel(picked)}
                    </span>
                </Button>
                {onRetract && value !== null && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full min-w-0"
                        onClick={onRetract}
                    >
                        <Undo2 aria-hidden />
                        <span className="truncate">{t('Remove my vote')}</span>
                    </Button>
                )}
            </DrawerFooter>
        </div>
    );
}

export function VoteDrawer({
    open,
    onOpenChange,
    deck,
    value = null,
    disabledValues,
    revealed = false,
    onVote,
    onRetract,
    description,
    modal,
    container,
    className,
}: VoteDrawerProps) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(open);

    useEffect(() => {
        if (open && revealed) {
            onOpenChange(false);
        }
    }, [open, revealed, onOpenChange]);

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
                    <DrawerTitle>{t('Choose your card')}</DrawerTitle>
                    <DrawerDescription>
                        {description ??
                            t('Pick a card, then validate your vote.')}
                    </DrawerDescription>
                </DrawerHeader>
                <VoteDrawerPanel
                    deck={deck}
                    value={value}
                    disabledValues={disabledValues}
                    onVote={(card) => {
                        onVote(card);
                        onOpenChange(false);
                    }}
                    onRetract={
                        onRetract
                            ? () => {
                                  onRetract();
                                  onOpenChange(false);
                              }
                            : undefined
                    }
                />
            </DrawerContent>
        </Drawer>
    );
}
