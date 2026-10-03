import { Check } from 'lucide-react';
import { useId } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { decodedPuzzles, type DecodedPuzzle } from '@/lib/games/decoded';
import { cn } from '@/lib/utils';
import { useRoom } from './room-context';

type Props = { className?: string };

/**
 * Decoded's "Puzzles" (spec §6.16, the mockup's `.em-round` rows): the done
 * puzzles of the run with their clue, word and finder, the current one, and
 * the coming ones as empty slots that tell nothing of their content. Between
 * two rounds of the game the list stays, without a current row.
 */
export function DecodedPuzzles({ className }: Props) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const headingId = useId();
    const { room, round } = snapshot;
    const run = decodedPuzzles(snapshot.history, round, room);

    if (run === null || run.puzzles.length === 0) {
        return null;
    }

    const progress =
        run.total === null ? `${run.played}` : `${run.played} / ${run.total}`;

    return (
        <section
            aria-labelledby={headingId}
            data-slot="decoded-puzzles"
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex items-baseline justify-between gap-2">
                <h2
                    id={headingId}
                    className="min-w-0 truncate text-base font-title"
                >
                    {t('Puzzles')}
                </h2>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {progress}
                </span>
            </div>
            <ol className="flex flex-col gap-0.5">
                {run.puzzles.map((puzzle) => (
                    <PuzzleRow
                        key={puzzle.number}
                        puzzle={puzzle}
                        clue={round?.clue ?? []}
                    />
                ))}
            </ol>
        </section>
    );
}

function PuzzleRow({
    puzzle,
    clue,
}: {
    puzzle: DecodedPuzzle;
    /** The clue of the current puzzle so far. */
    clue: string[];
}) {
    const { t } = useTrans();

    return (
        <li
            data-state={puzzle.state}
            aria-current={puzzle.state === 'current' ? 'step' : undefined}
            className={cn(
                'grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-2.5 py-2',
                puzzle.state === 'current' &&
                    'bg-skrum-primary-soft ring-1 ring-primary ring-inset',
                puzzle.state === 'next' &&
                    'border border-dashed border-input text-muted-foreground',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'grid size-6 place-items-center rounded-full text-xs font-bold',
                    puzzle.state === 'done' &&
                        'bg-skrum-success-soft text-skrum-success-text',
                    puzzle.state === 'current' &&
                        'bg-primary text-primary-foreground',
                    puzzle.state === 'next' && 'bg-muted text-muted-foreground',
                )}
            >
                {puzzle.state === 'done' ? (
                    <Check className="size-3" />
                ) : (
                    puzzle.number
                )}
            </span>
            <PuzzleBody puzzle={puzzle} clue={clue} />
            {puzzle.state === 'done' ? (
                <span className="max-w-28 truncate text-xs font-semibold text-muted-foreground">
                    {puzzle.finderName === null
                        ? t('Not found')
                        : t('Found by :name', { name: puzzle.finderName })}
                </span>
            ) : (
                <span />
            )}
        </li>
    );
}

function PuzzleBody({
    puzzle,
    clue,
}: {
    puzzle: DecodedPuzzle;
    clue: string[];
}) {
    const { t } = useTrans();

    if (puzzle.state === 'next') {
        return (
            <span className="truncate text-xs">
                {t('Puzzle :number', { number: puzzle.number })}
            </span>
        );
    }

    if (puzzle.state === 'current') {
        return (
            <span className="flex min-w-0 flex-col">
                <span className="sr-only">
                    {t('Puzzle :number', { number: puzzle.number })}
                </span>
                {clue.length > 0 && <ClueText clue={clue} />}
                <span className="truncate text-xs font-semibold text-skrum-primary-text">
                    {t('Puzzle in progress')}
                </span>
            </span>
        );
    }

    return (
        <span className="flex min-w-0 flex-col">
            <span className="sr-only">
                {t('Puzzle :number', { number: puzzle.number })}
            </span>
            {puzzle.clue.length > 0 && <ClueText clue={puzzle.clue} />}
            {puzzle.word !== null && (
                <span className="truncate text-xs text-muted-foreground">
                    {puzzle.word}
                </span>
            )}
        </span>
    );
}

/** The mockup's `.em-seq`: the emojis on one line, named as the stage names them. */
function ClueText({ clue }: { clue: string[] }) {
    const { t } = useTrans();

    return (
        <span
            role="img"
            aria-label={t('Clue: :emoji', { emoji: clue.join(' ') })}
            className="truncate text-lg leading-6 tracking-wide"
        >
            {clue.join('')}
        </span>
    );
}
