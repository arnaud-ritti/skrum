import { useTrans } from '@/hooks/use-trans';
import type { GameMask } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = { mask: GameMask; className?: string };

export function WordMask({ mask, className }: Props) {
    const { t } = useTrans();
    const hidden = mask.filter((character) => character === null).length;

    return (
        <div
            role="img"
            aria-label={t(':count letters left to find', { count: hidden })}
            className={cn('flex flex-wrap justify-center gap-1.5', className)}
        >
            {mask.map((character, index) => {
                if (character === ' ') {
                    return <span key={index} className="w-4" />;
                }

                if (character === '-' || character === "'") {
                    return (
                        <span
                            key={index}
                            className="self-end text-2xl font-semibold"
                        >
                            {character}
                        </span>
                    );
                }

                return (
                    <span
                        key={index}
                        className="flex h-10 w-8 items-end justify-center border-b-2 border-foreground pb-0.5 text-2xl font-semibold uppercase"
                    >
                        {character ?? ''}
                    </span>
                );
            })}
        </div>
    );
}
