import { useTrans } from '@/hooks/use-trans';
import type { HealthResults, HealthTrendPoint } from '@/lib/retro/types';
import { formatScore, HealthRadar } from './health-radar';
import { HealthTrend } from './health-trend';
import { ResultsSection } from './results-section';

type Props = { health: HealthResults; trend: HealthTrendPoint[] | null };

function Stat({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
            {detail && (
                <dd className="text-xs text-muted-foreground">{detail}</dd>
            )}
        </div>
    );
}

export function HealthSection({ health, trend }: Props) {
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Team health')}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
                <HealthRadar statements={health.statements} />
                <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <Stat
                            label={t('Score')}
                            value={`${formatScore(health.score)}/10`}
                        />
                        <Stat
                            label={t('Participation')}
                            value={t(
                                ':respondents / :participants participants',
                                health.participation,
                            )}
                        />
                        {health.topStrength && (
                            <Stat
                                label={t('Top strength')}
                                value={health.topStrength.label}
                                detail={`${formatScore(health.topStrength.average)}/10`}
                            />
                        )}
                        {health.growthArea && (
                            <Stat
                                label={t('Growth area')}
                                value={health.growthArea.label}
                                detail={`${formatScore(health.growthArea.average)}/10`}
                            />
                        )}
                        <Stat
                            label={t('Alignment')}
                            value={`${health.alignment.value}/10`}
                            detail={health.alignment.label}
                        />
                    </dl>
                    <p className="text-sm">
                        <strong>{health.assessment.title}</strong>{' '}
                        {health.assessment.sentence}
                    </p>
                    {trend !== null && trend.length > 0 && (
                        <HealthTrend points={trend} />
                    )}
                </div>
            </div>
            <ul className="divide-y rounded-md border text-sm">
                {health.statements.map((statement) => (
                    <li
                        key={statement.key}
                        className="flex items-center justify-between gap-3 p-2"
                    >
                        <span className="min-w-0">{statement.text}</span>
                        <span className="shrink-0 tabular-nums">
                            {statement.average === null
                                ? t('No answers')
                                : `${formatScore(statement.average)}/10`}
                        </span>
                    </li>
                ))}
            </ul>
        </ResultsSection>
    );
}
