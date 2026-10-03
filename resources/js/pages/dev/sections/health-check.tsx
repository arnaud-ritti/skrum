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
            key: `built-in-${index}`,
            ...item,
            isBuiltin: true,
            isArchived: index === 3,
        })),
        {
            id: 'custom-1',
            key: 'custom-1',
            label: t('Deploys'),
            text: t('Our deployments felt safe'),
            isBuiltin: false,
            isArchived: false,
        },
    ];
    const [statements, setStatements] = useState(initial);
    const [answers, setAnswers] = useState<
        Record<string, HealthScore | null | undefined>
    >({
        'built-in-0': 4,
        'built-in-1': 3,
        'built-in-3': 5,
        'built-in-4': 2,
    });
    const [submitted, setSubmitted] = useState(false);
    const people = [
        'Camille Roux',
        'Inès Benali',
        'Théo Martin',
        'Nadia Haddad',
        'Lucas Petit',
        'Sofia Garcia',
        'Jonas Weber',
        'Aiko Tanaka',
        'Marta Kowalska',
        'Olivier Dubois',
        'Priya Nair',
        'Samuel Okafor',
        'Elena Rossi',
        'Hugo Lefebvre',
    ].map((name, index) => ({ id: `person-${index}`, name }));
    const formStatements = base.map((item, index) => ({
        key: `built-in-${index}`,
        ...item,
    }));
    const liveStatements = formStatements.map((statement, index) => ({
        ...statement,
        count: index === 5 ? 0 : people.length - index,
        answeredBy: index === 5 ? [] : people.slice(0, people.length - index),
    }));
    const complete = Object.fromEntries(
        formStatements.map((s, index) => [s.key, ((index * 3) % 5) + 1]),
    );
    const retro = t('Sprint 42');
    const previous = t('sprint 41');
    const serverResults: HealthCheckResult[] = [
        4.1,
        3.8,
        4.4,
        3.2,
        2.2,
        null,
    ].map((average, index) => ({
        key: `built-in-${index}`,
        ...base[index],
        average,
        count: average === null ? 0 : 8,
    }));
    const distributions = [
        [0, 0, 1, 4, 3],
        [0, 1, 2, 3, 2],
        [0, 0, 0, 3, 5],
        [0, 2, 3, 2, 1],
        [2, 2, 3, 1, 0],
        [0, 1, 3, 3, 1],
    ];
    const results: HealthCheckResult[] = [
        [4.0, 3.9],
        [3.8, 3.7],
        [4.4, 4.4],
        [3.2, 3.4],
        [2.2, 2.8],
        [3.5, 3.1],
    ].map(([average, previousAverage], index) => ({
        key: `built-in-${index}`,
        label: base[index].label,
        distribution: distributions[index],
        average,
        previousAverage,
    }));
    const summary = {
        score: 3.5,
        topStrength: { label: base[2].label, average: 4.4 },
        growthArea: { label: base[4].label, average: 2.2 },
        alignment: { value: 6, label: t('Moderate alignment') },
        assessment: {
            title: t('Good health.'),
            sentence: t(
                'The team is doing well overall; processes need attention.',
            ),
        },
    };
    const longStatements: HealthStatement[] = Array.from(
        { length: 200 },
        (_, index) => ({
            id: `long-${index}`,
            label: t('Cross-team dependencies').padEnd(30, '!'),
            text: t(
                'Dependencies on other teams were identified early enough and handled without blocking our sprint goal or our releases, every single time',
            ),
            isBuiltin: index % 3 === 0,
            isArchived: index >= 190,
        }),
    );
    const noop = () => undefined;
    const nextId = () => `custom-${statements.length + 1}`;
    const setArchived = (id: string, isArchived: boolean) =>
        setStatements((list) =>
            list.map((s) => (s.id === id ? { ...s, isArchived } : s)),
        );

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6 p-4 md:p-6">
            <State
                label={t(
                    'Manager, interactive (Space on a handle, arrows, Space; add, edit custom, archive, restore)',
                )}
            >
                <HealthStatementsManager
                    statements={statements}
                    canManage
                    defaultArchivedOpen
                    onReorder={(ids) =>
                        setStatements((list) => [
                            ...ids
                                .map((id) => list.find((s) => s.id === id))
                                .filter((s) => s !== undefined),
                            ...list.filter((s) => s.isArchived),
                        ])
                    }
                    onAdd={(draft) =>
                        setStatements((list) => [
                            ...list,
                            {
                                id: nextId(),
                                ...draft,
                                isBuiltin: false,
                                isArchived: false,
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
                    onArchive={(id) => setArchived(id, true)}
                    onRestore={(id) => setArchived(id, false)}
                />
            </State>
            <State label={t('Manager, read-only (no manage rights)')}>
                <HealthStatementsManager
                    statements={initial}
                    canManage={false}
                    defaultArchivedOpen
                    onReorder={noop}
                    onAdd={noop}
                />
            </State>
            <State label={t('Manager, empty')}>
                <HealthStatementsManager
                    statements={[]}
                    canManage
                    onReorder={noop}
                    onAdd={noop}
                />
            </State>
            <State label={t('Manager, server errors')}>
                <HealthStatementsManager
                    statements={initial.slice(0, 2)}
                    canManage
                    error={t('The order could not be saved.')}
                    addErrors={{
                        text: t('The text field is required.'),
                        label: t(
                            'The label field must not be greater than 30 characters.',
                        ),
                    }}
                    onReorder={noop}
                    onAdd={noop}
                    onArchive={noop}
                />
            </State>
            <State
                label={t(
                    'Manager, 200 statements at the server limits (30 and 150 characters)',
                )}
            >
                <div className="max-h-120 overflow-y-auto">
                    <HealthStatementsManager
                        statements={longStatements}
                        canManage
                        onReorder={noop}
                        onAdd={noop}
                        onEdit={noop}
                        onArchive={noop}
                        onRestore={noop}
                    />
                </div>
            </State>
            <State
                label={t(
                    'Answer view on the health scale, 1 to 5, each answer on its own, clear, live progress',
                )}
            >
                <HealthCheckForm
                    retroTitle={retro}
                    statements={liveStatements}
                    answers={answers}
                    onAnswer={(key, value) =>
                        setAnswers((current) => ({ ...current, [key]: value }))
                    }
                    onClear={(key) =>
                        setAnswers((current) => ({ ...current, [key]: null }))
                    }
                />
            </State>
            <State
                label={t(
                    'Answer view with a submit step, 4 of 6 answered (submit disabled), interactive',
                )}
            >
                <HealthCheckForm
                    retroTitle={retro}
                    statements={formStatements}
                    answers={answers}
                    onAnswer={(key, value) =>
                        setAnswers((current) => ({ ...current, [key]: value }))
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
            <State label={t('Answer view, no statement')}>
                <HealthCheckForm
                    retroTitle={retro}
                    statements={[]}
                    onAnswer={noop}
                />
            </State>
            <State
                label={t(
                    'Answer view, 1 to 10 scale of an imported health check, narrow container (20rem)',
                )}
                width="w-80 max-w-full"
            >
                <HealthCheckForm
                    retroTitle={retro}
                    statements={liveStatements.slice(0, 2)}
                    answers={{ 'built-in-0': 8 }}
                    scale={10}
                    onAnswer={noop}
                    onClear={noop}
                />
            </State>
            <State
                label={t(
                    'Results as the server sends them: averages out of 5, summary, no distribution',
                )}
            >
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={8}
                    participants={9}
                    minimumRespondents={0}
                    results={serverResults}
                    summary={summary}
                >
                    <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                        {t('Slot: radar and trend across retros')}
                    </p>
                </HealthCheckResults>
            </State>
            <State
                label={t(
                    'Results with distribution, trend up, down and unchanged, one alert below 3',
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
                        previousAverage: undefined,
                    }))}
                />
            </State>
            <State label={t('Results hidden below three respondents')}>
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={2}
                    participants={9}
                    minimumRespondents={3}
                    previousRetroTitle={previous}
                    results={results}
                />
            </State>
            <State label={t('Results, no statement')}>
                <HealthCheckResults
                    retroTitle={retro}
                    respondents={8}
                    participants={9}
                    results={[]}
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
                    summary={summary}
                />
            </State>
        </div>
    );
}
