import { useTrans } from '@/hooks/use-trans';
import { ClueSlots } from '@/lib/games/clue';
import { cn } from '@/lib/utils';

type Props = { clue: string[]; className?: string };

export function ClueRow({ clue, className }: Props) {
    const { t } = useTrans();

    return (
        <div
            role="img"
            aria-label={
                clue.length === 0
                    ? t('No clue yet')
                    : t('Clue: :emoji', { emoji: clue.join(' ') })
            }
            className={cn('flex justify-center gap-2', className)}
        >
            {Array.from({ length: ClueSlots }, (_, index) => (
                <span
                    key={index}
                    className="flex size-14 items-center justify-center rounded-lg border bg-muted/40 text-3xl"
                >
                    {clue[index] ?? ''}
                </span>
            ))}
        </div>
    );
}
