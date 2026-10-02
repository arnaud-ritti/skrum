import { useTrans } from '@/hooks/use-trans';
import type { RotiResults } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { RotiVote } from '../phase-roti';
import { ResultsSection } from './results-section';

const RotiLabels = [
    'Time wasted',
    'Not really worth it',
    'Break-even',
    'Good use of time',
    'Excellent use of time',
] as const;

export function RotiSection({ roti }: { roti: RotiResults }) {
    const { t } = useTrans();
    const { board } = useBoard();
    const { canVote, respondents } = board.roti;
    const highest = Math.max(1, ...roti.distribution.map((row) => row.count));

    return (
        <ResultsSection title={t('Return on time invested')}>
            <div
                className={
                    canVote
                        ? 'grid items-start gap-6 md:grid-cols-2'
                        : undefined
                }
            >
                {canVote && <RotiVote />}
                {roti.respondents === 0 || roti.average === null ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No ratings yet.')}
                    </p>
                ) : (
                    <div className="space-y-2 text-sm">
                        <p>
                            {t('Average: :value', {
                                value: `${roti.average.toFixed(1)}/5`,
                            })}
                        </p>
                        <ul className="space-y-1">
                            {roti.distribution.map(({ score, count }) => (
                                <li
                                    key={score}
                                    className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2"
                                >
                                    <span className="truncate text-xs">
                                        {score} · {t(RotiLabels[score - 1])}
                                    </span>
                                    <div className="h-2 rounded-full bg-muted">
                                        <div
                                            className="h-2 rounded-full bg-primary motion-safe:transition-[width]"
                                            style={{
                                                width: `${(count / highest) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-right tabular-nums">
                                        {count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
                {t(respondents === 1 ? ':count rating' : ':count ratings', {
                    count: respondents,
                })}
            </p>
        </ResultsSection>
    );
}
