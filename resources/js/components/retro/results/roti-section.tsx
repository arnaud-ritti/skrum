import { useTrans } from '@/hooks/use-trans';
import type { RotiResults } from '@/lib/retro/types';
import { RotiControl, RotiLabels } from '../roti-control';
import { ResultsSection } from './results-section';

export function RotiSection({ roti }: { roti: RotiResults }) {
    const { t } = useTrans();
    const highest = Math.max(1, ...roti.distribution.map((row) => row.count));

    return (
        <ResultsSection title={t('Return on time invested')}>
            <div className="grid gap-6 md:grid-cols-2">
                <RotiControl />
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
        </ResultsSection>
    );
}
