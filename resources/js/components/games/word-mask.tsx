import { useTrans } from '@/hooks/use-trans';
import type { GameMask } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = {
    mask: GameMask;
    /** `lg` on the hangman stage; `md` beside a drawing and in the history. */
    size?: 'md' | 'lg';
    className?: string;
};

const cellClasses = {
    md: 'h-9 w-7 border-b-3 text-xl',
    lg: 'h-12 w-9 border-b-3 text-stat sm:h-14 sm:w-11 sm:text-3xl',
};

const gapClasses = { md: 'w-3', lg: 'w-4 sm:w-5' };

export function WordMask({ mask, size = 'md', className }: Props) {
    const { t } = useTrans();
    const hidden = mask.filter((character) => character === null).length;

    return (
        <div
            role="img"
            aria-label={t(':count letters left to find', { count: hidden })}
            data-slot="word-mask"
            className={cn(
                'flex max-w-full flex-wrap justify-center',
                size === 'lg' ? 'gap-1.5 sm:gap-2.5' : 'gap-1.5',
                className,
            )}
        >
            {mask.map((character, index) => {
                if (character === ' ') {
                    return <span key={index} className={gapClasses[size]} />;
                }

                if (character === '-' || character === "'") {
                    return (
                        <span
                            key={index}
                            className={cn(
                                'grid place-items-center border-transparent font-display font-bold',
                                cellClasses[size],
                                'w-auto',
                            )}
                        >
                            {character}
                        </span>
                    );
                }

                return (
                    <span
                        key={index}
                        className={cn(
                            'grid place-items-center border-foreground font-display font-bold uppercase',
                            cellClasses[size],
                        )}
                    >
                        {character ?? ''}
                    </span>
                );
            })}
        </div>
    );
}
