import { useTrans } from '@/hooks/use-trans';
import { ClueSlots } from '@/lib/games/clue';
import { cn } from '@/lib/utils';

type ClueSize = 'md' | 'lg';

type Props = {
    clue: string[];
    /** `lg` on the stage, inside a container; `md` in the history and the retro results. */
    size?: ClueSize;
    className?: string;
};

export const clueGapClasses: Record<ClueSize, string> = {
    md: 'gap-2',
    lg: 'gap-1.5 @md:gap-2 @xl:gap-3',
};

/** One slot of a clue; the editor draws its buttons on the same box. */
export const clueTileClasses: Record<ClueSize, string> = {
    md: 'size-14 rounded-lg text-3xl',
    lg: 'size-11 rounded-lg text-2xl @xs:size-14 @xs:text-3xl @md:size-20 @md:rounded-2xl @md:text-5xl @xl:size-24 @xl:text-6xl',
};

export function ClueRow({ clue, size = 'md', className }: Props) {
    const { t } = useTrans();

    return (
        <div
            role="img"
            aria-label={
                clue.length === 0
                    ? t('No clue yet')
                    : t('Clue: :emoji', { emoji: clue.join(' ') })
            }
            data-slot="clue-row"
            className={cn(
                'flex justify-center',
                clueGapClasses[size],
                className,
            )}
        >
            {Array.from({ length: ClueSlots }, (_, index) => {
                const emoji = clue[index];

                return (
                    <span
                        key={index}
                        data-filled={emoji !== undefined || undefined}
                        className={cn(
                            'flex shrink-0 items-center justify-center border leading-none',
                            clueTileClasses[size],
                            emoji === undefined
                                ? 'border-dashed border-input'
                                : 'bg-card shadow-card',
                        )}
                    >
                        {emoji ?? ''}
                    </span>
                );
            })}
        </div>
    );
}
