import { useTrans } from '@/hooks/use-trans';
import { keyboardRows } from '@/lib/games/hangman';
import type { KeyboardLayout } from '@/lib/games/hangman';
import { cn } from '@/lib/utils';

export type LetterKeyboardProps = {
    layout: KeyboardLayout;
    picked: string[];
    /** The picked letters that are in the word; the other picked letters are misses. */
    hits: string[];
    /** A pick is on its way: no key answers. */
    disabled: boolean;
    onPick: (letter: string) => void;
    className?: string;
};

type KeyState = 'free' | 'hit' | 'miss';

const stateClasses: Record<KeyState, string> = {
    free: 'border-input bg-card shadow-card hover:border-primary hover:ring-1 hover:ring-primary',
    hit: 'border-transparent bg-skrum-success-soft text-skrum-success-text',
    miss: 'border-transparent bg-muted text-muted-foreground line-through opacity-70',
};

export function LetterKeyboard({
    layout,
    picked,
    hits,
    disabled,
    onPick,
    className,
}: LetterKeyboardProps) {
    const { t } = useTrans();

    const stateOf = (letter: string): KeyState => {
        if (!picked.includes(letter)) {
            return 'free';
        }

        return hits.includes(letter) ? 'hit' : 'miss';
    };

    return (
        <div
            role="group"
            aria-label={t('Letters')}
            data-layout={layout}
            className={cn(
                'flex w-full max-w-136 flex-col items-center gap-1.5 sm:gap-2',
                className,
            )}
        >
            {keyboardRows(layout).map((row) => (
                <div
                    key={row.join('')}
                    data-slot="keyboard-row"
                    className="flex w-full justify-center gap-1 sm:gap-1.5"
                >
                    {row.map((letter) => {
                        const state = stateOf(letter);
                        const isLocked = disabled || state !== 'free';
                        const outcomes = {
                            free: undefined,
                            hit: `${letter}, ${t('in the word')}`,
                            miss: `${letter}, ${t('not in the word')}`,
                        };

                        return (
                            <button
                                key={letter}
                                type="button"
                                data-state={state}
                                aria-label={outcomes[state]}
                                aria-disabled={isLocked}
                                aria-pressed={state !== 'free'}
                                onClick={() => {
                                    if (!isLocked) {
                                        onPick(letter);
                                    }
                                }}
                                className={cn(
                                    'grid h-11.5 max-w-11.5 min-w-0 flex-1 place-items-center rounded-md border text-base font-bold uppercase outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-shadow motion-safe:duration-140 sm:h-12',
                                    stateClasses[state],
                                    state === 'free' &&
                                        'aria-disabled:cursor-default aria-disabled:hover:border-input aria-disabled:hover:ring-0',
                                )}
                            >
                                {letter}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
