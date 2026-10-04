import { Check } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

/** 0 before the first round; 1 picking, 2 voting, 3 the results. */
type GifStep = 0 | 1 | 2 | 3;

/** Where Sprint in one GIF stands in this room; null when another game is on. */
export function useGifStep(): GifStep | null {
    const { snapshot, lastEnded } = useRoom();
    const { room, round, history } = snapshot;

    if (round) {
        if (round.game !== 'gif') {
            return null;
        }

        return round.revealedAt === null ? 1 : 2;
    }

    if (room.game !== 'gif') {
        return null;
    }

    const last = history.find((played) => played.id === room.currentRoundId);

    return lastEnded?.answers !== undefined || last?.game === 'gif' ? 3 : 0;
}

/** The line above the name of the game. */
export function GifStepLine({ step }: { step: 1 | 2 | 3 }) {
    const { t } = useTrans();
    const labels = {
        1: t('Step 1 of 3 · Pick a GIF'),
        2: t('Step 2 of 3 · Reveal & vote'),
        3: t('Step 3 of 3 · Results'),
    };

    return (
        <p
            data-slot="round-status"
            className="min-w-0 truncate text-overline text-muted-foreground uppercase"
        >
            {labels[step]}
        </p>
    );
}

/** "How it works": the three steps of a round, the one in play marked. */
export function GifSteps({ step }: { step: GifStep }) {
    const { t } = useTrans();
    const steps = [t('Pick a GIF'), t('Reveal & vote'), t('Winner')];

    return (
        <section
            data-slot="gif-steps"
            aria-labelledby="gif-steps-title"
            className="flex min-w-0 flex-col gap-2"
        >
            <h2 id="gif-steps-title" className="text-sm font-medium">
                {t('How it works')}
            </h2>
            <ol className="flex flex-col gap-0.5">
                {steps.map((label, index) => {
                    const number = index + 1;
                    const isCurrent = number === step;
                    const isDone = number < step;

                    return (
                        <li
                            key={label}
                            aria-current={isCurrent ? 'step' : undefined}
                            data-done={isDone || undefined}
                            className={cn(
                                'flex min-w-0 items-center gap-3 rounded-md px-2.5 py-1.5 text-body-sm font-semibold text-muted-foreground',
                                isDone && 'text-foreground',
                                isCurrent &&
                                    'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset',
                            )}
                        >
                            <span
                                aria-hidden={isDone || undefined}
                                className={cn(
                                    'grid size-5.5 shrink-0 place-items-center rounded-full bg-muted text-overline font-bold tracking-normal text-muted-foreground',
                                    isDone &&
                                        'bg-skrum-success-soft text-skrum-success-text',
                                    isCurrent &&
                                        'bg-primary text-primary-foreground',
                                )}
                            >
                                {isDone ? (
                                    <Check aria-hidden className="size-3.5" />
                                ) : (
                                    number
                                )}
                            </span>
                            <span className="min-w-0 truncate">
                                {label}
                                {isDone && (
                                    <span className="sr-only">
                                        {` (${t('Done')})`}
                                    </span>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
