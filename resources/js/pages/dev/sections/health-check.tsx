import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import type { HealthScore } from '@/components/skrum/health-check-form';
import { HealthCheckResults } from '@/components/skrum/health-check-results';
import type { HealthCheckResult } from '@/components/skrum/health-check-results';
import { HealthStatementsManager } from '@/components/skrum/health-check-manager';
import type { HealthStatement } from '@/components/skrum/health-check-manager';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({
    label,
    children,
    width,
}: {
    label: string;
    children: ReactNode;
    width?: string;
}) {
    return (
        <div className={width ?? 'min-w-0'}>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

export default function HealthCheckSection() {
    const { t } = useTrans();
    const base = [
        {
            label: t('Interaction'),
            text: t('Interaction with colleagues was productive'),
        },
        { label: t('Clear tasks'), text: t('Tasks assigned to me were clear') },
        {
            label: t('Manager support'),
            text: t('My manager was understanding and supportive'),
        },
        { label: t('Vision'), text: t('The vision and goals are clear to me') },
        {
            label: t('Processes'),
            text: t('Our processes let me work without blockers'),
        },
        { label: t('Motivation'), text: t('I felt motivated in my work') },
    ];
    const initial: HealthStatement[] = [
        ...base.map((item, index) => ({
            id: `built-in-${index}`,
            ...item,
            builtIn: true,
            enabled: index !== 3,
            position: index + 1,
        })),
        {
            id: 'custom-1',
            label: t('Deploys'),
            text: t('Our deployments felt safe'),
            builtIn: false,
            enabled: true,
            position: 7,
        },
    ];
    const [statements, setStatements] = useState(initial);
    const [answers, setAnswers] = useState<
        Record<string, HealthScore | undefined>
    >({
        'built-in-0': 4,
        'built-in-1': 3,
        'built-in-3': 5,
        'built-in-4': 2,
    });
    const [submitted, setSubmitted] = useState(false);
    const formStatements = base.map((item, index) => ({
        id: `built-in-${index}`,
        ...item,
    }));
    const complete = Object.fromEntries(
        formStatements.map((s, index) => [
            s.id,
            ((index % 5) + 1) as HealthScore,
        ]),
    );
    const retro = t('Sprint 42');
    const previous = t('sprint 41');
    const results: HealthCheckResult[] = [
        {
            statementId: 'a',
            label: base[0].label,
            distribution: [0, 0, 2, 4, 2],
            mean: 4.0,
            previousMean: 3.7,
        },
        {
            statementId: 'b',
            label: base[1].label,
            distribution: [0, 1, 2, 3, 2],
            mean: 3.8,
            previousMean: 3.7,
        },
        {
            statementId: 'c',
            label: base[2].label,
            distribution: [0, 0, 1, 3, 4],
            mean: 4.4,
            previousMean: 4.4,
        },
        {
            statementId: 'd',
            label: base[3].label,
            distribution: [0, 2, 3, 2, 1],
            mean: 3.2,
            previousMean: 3.4,
        },
        {
            statementId: 'e',
            label: base[4].label,
            distribution: [2, 3, 2, 1, 0],
            mean: 2.2,
            previousMean: 2.8,
        },
        {
            statementId: 'f',
            label: base[5].label,
            distribution: [0, 1, 3, 3, 1],
            mean: 3.5,
            previousMean: 3.1,
        },
    ];
    const noop = () => undefined;
    const nextId = () => `custom-${statements.length + 1}`;

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6 p-4 md:p-6">
            <State
                label={t(
                    'Manager, interactive (Space on a handle, arrows, Space; built-in, disabled and custom rows)',
                )}
            >
                <HealthStatementsManager
                    statements={statements}
                    canManage
                    onToggle={(id, enabled) =>
                        setStatements((list) =>
                            list.map((s) =>
                                s.id === id ? { ...s, enabled } : s,
                            ),
                        )
                    }
                    onReorder={(ids) =>
                        setStatements((list) =>
                            list.map((s) => ({
                                ...s,
                                position: ids.indexOf(s.id) + 1,
                            })),
                        )
                    }
                    onAdd={(draft) =>
                        setStatements((list) => [
                            ...list,
                            {
                                id: nextId(),
                                ...draft,
                                builtIn: false,
                                enabled: true,
                                position: list.length + 1,
                            },
                        ])
                    }
                    onEdit={(id, draft) =>
                        setStatements((list) =>
                            list.map((s) =>
                                s.id === id ? { ...s, ...draft } : s,
                            ),
                        )
                    }
                    onDelete={(id) =>
                        setStatements((list) => list.filter((s) => s.id !== id))
                    }
                />
            </State>
            <State label={t('Manager, read-only (no manage rights)')}>
                <HealthStatementsManager
                    statements={initial}
                    canManage={false}
                    onToggle={noop}
                    onReorder={noop}
                    onAdd={noop}
                />
            </State>
            <State label={t('Manager, empty')}>
                <HealthStatementsManager
                    statements={[]}
                    canManage
                    onToggle={noop}
                    onReorder={noop}
                    onAdd={noop}
                />
            </State>
            <State
                label={t(
                    'Answer view, 4 of 6 answered (submit disabled), interactive; keys 1 to 5',
                )}
            >
                <HealthCheckForm
                    retroTitle={retro}
                    statements={formStatements}
                    answers={answers}
                    onAnswer={(id, value) =>
                        setAnswers((current) => ({ ...current, [id]: value }))
                    }
                    onSubmit={() => setSubmitted(true)}
                    submitted={submitted}
                />
            </State>
            <State label={t('Answer view, all answered (submit enabled)')}>
                <HealthCheckForm
                    retroTitle={retro}
                    statements={formStatements}
                    answers={complete}
                    onAnswer={noop}
                    onSubmit={noop}
                />
            </State>
            <State label={t('Answer view, submitted (read-only)')}>
                <HealthCheckForm
                    retroTitle={retro}
                    statements={formStatements}
                    answers={complete}
                    onAnswer={noop}
                    onSubmit={noop}
                    submitted
                />
            </State>
            <State
                label={t(
                    'Results, trend up, down and unchanged, one alert below 3',
                )}
            >
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={8}
                    participants={9}
                    previousRetroTitle={previous}
                    results={results}
                />
            </State>
            <State label={t('Results, no previous retro (trend hidden)')}>
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={8}
                    participants={9}
                    results={results.map((r) => ({
                        ...r,
                        previousMean: undefined,
                    }))}
                />
            </State>
            <State label={t('Results hidden below three respondents')}>
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={2}
                    participants={9}
                    previousRetroTitle={previous}
                    results={results}
                />
            </State>
            <State
                label={t('Results, narrow container (20rem)')}
                width="w-80 max-w-full"
            >
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={8}
                    participants={9}
                    previousRetroTitle={previous}
                    results={results.slice(2, 5)}
                />
            </State>
        </div>
    );
}
