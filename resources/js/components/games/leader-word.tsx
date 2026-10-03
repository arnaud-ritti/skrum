import { Check, EyeOff, Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { hintsUsed } from '@/lib/games/hints';
import type { GameMask } from '@/lib/games/types';
import { cn } from '@/lib/utils';
import { WordMask } from './word-mask';

type WordCardProps = { children: ReactNode; className?: string };

/** The card of the word above a drawing or a clue: the word itself, or its mask. */
function WordCard({ children, className }: WordCardProps) {
    return (
        <div
            data-slot="word-card"
            className={cn(
                'flex max-w-full shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-2 shadow-card',
                className,
            )}
        >
            {children}
        </div>
    );
}

type Props = {
    word: string | null;
    label: string;
    /** Right end of the card: what the leader can do about the word. */
    action?: ReactNode;
    /** Under the word: when the next hint comes on its own. */
    footnote?: ReactNode;
    /** False for a Draw & Guess finder: the word is no longer only theirs (spec §6.15). */
    secret?: boolean;
};

export function LeaderWord({
    word,
    label,
    action,
    footnote,
    secret = true,
}: Props) {
    const { t } = useTrans();
    const Icon = secret ? EyeOff : Check;

    return (
        <WordCard className={cn(action !== undefined && 'pr-2')}>
            <div className="flex min-w-0 flex-col">
                <span
                    className={cn(
                        'flex min-w-0 items-center gap-1 text-overline uppercase',
                        secret
                            ? 'text-muted-foreground'
                            : 'text-skrum-success-text',
                    )}
                >
                    <Icon aria-hidden className="size-3.5 shrink-0" />
                    <span className="min-w-0">
                        {label}
                        {secret && (
                            <span className="font-medium">
                                {' · '}
                                {t('only you see it')}
                            </span>
                        )}
                    </span>
                </span>
                <span className="font-display text-2xl font-bold tracking-wider break-words">
                    {word ?? '…'}
                </span>
                {footnote}
            </div>
            {action}
        </WordCard>
    );
}

type MaskedWordProps = {
    mask: GameMask;
    maxHints: number;
    /** Under the hint line: when the next hint comes on its own. */
    footnote?: ReactNode;
};

/** The word as its guessers see it: its blanks, and how many letters the leader gave away. */
export function MaskedWord({ mask, maxHints, footnote }: MaskedWordProps) {
    const { t } = useTrans();

    return (
        <WordCard>
            <WordMask mask={mask} hint />
            <span
                aria-hidden
                className="hidden h-8 w-px shrink-0 bg-border sm:block"
            />
            <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1 text-overline text-muted-foreground uppercase">
                    <Lightbulb aria-hidden className="size-3.5 shrink-0" />
                    {t('Hint')}
                </span>
                <span role="status" className="text-xs text-muted-foreground">
                    {t('Letters revealed: :count of :max', {
                        count: hintsUsed(mask),
                        max: maxHints,
                    })}
                </span>
                {footnote}
            </div>
        </WordCard>
    );
}
