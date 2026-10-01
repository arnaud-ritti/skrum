import { Dices, Download, LayoutTemplate, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { EmptyState } from '@/components/skrum/empty-state';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function EmptyStateSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('First use: Retrospective')}>
                <Card>
                    <EmptyState
                        module="retro"
                        title={t('No retrospective yet')}
                        description={t(
                            'Start the first retrospective of the team: one link is enough to invite everyone.',
                        )}
                        action={{ label: t('New retrospective'), icon: Plus }}
                    />
                </Card>
            </Example>
            <Example label={t('First use: Planning poker, two actions')}>
                <Card>
                    <EmptyState
                        module="poker"
                        title={t('No story to estimate')}
                        description={t(
                            'Import tickets from Jira or Linear, or add a story by hand.',
                        )}
                        action={{ label: t('Import'), icon: Download }}
                        secondaryAction={{ label: t('Add a story') }}
                    />
                </Card>
            </Example>
            <Example label={t('First use: Whiteboard, keyboard hint')}>
                <Card>
                    <EmptyState
                        module="whiteboard"
                        title={t('A blank canvas')}
                        description={
                            <>
                                {t('Press')}{' '}
                                <kbd className="rounded-sm border border-border bg-muted px-1.5 font-mono text-xs">
                                    N
                                </kbd>{' '}
                                {t(
                                    'to drop a sticky note, or start from a template.',
                                )}
                            </>
                        }
                        action={{
                            label: t('Choose a template'),
                            icon: LayoutTemplate,
                            variant: 'outline',
                        }}
                    />
                </Card>
            </Example>
            <Example label={t('First use: Surveys')}>
                <Card>
                    <EmptyState
                        module="survey"
                        title={t('No survey published')}
                        description={t(
                            'Measure morale or psychological safety in 2 minutes, anonymously.',
                        )}
                        action={{ label: t('Create a survey'), icon: Plus }}
                    />
                </Card>
            </Example>
            <Example label={t('First use: Icebreakers')}>
                <Card>
                    <EmptyState
                        module="icebreaker"
                        title={t('No game yet')}
                        description={t(
                            'Five minutes of play before the retrospective, and cameras switch on by themselves.',
                        )}
                        action={{
                            label: t('Choose a game'),
                            icon: Dices,
                            variant: 'outline',
                        }}
                    />
                </Card>
            </Example>
            <Example
                label={t('Positive state: Actions up to date, ghost action')}
            >
                <Card>
                    <EmptyState
                        module="actions"
                        title={t('No open action')}
                        description={t(
                            'Actions decided in retrospectives land here, with an owner and a due date. All up to date.',
                        )}
                        action={{
                            label: t('See completed actions'),
                            variant: 'ghost',
                        }}
                    />
                </Card>
            </Example>
            <Example label={t('Filtered empty list: no illustration')}>
                <Card>
                    <EmptyState
                        module="actions"
                        illustration={false}
                        title={t('No action matches these filters')}
                        description={t(
                            'Try removing a filter to see more results.',
                        )}
                        action={{
                            label: t('Clear filters'),
                            variant: 'outline',
                        }}
                    />
                </Card>
            </Example>
            <Example label={t('Narrow container, 20rem')}>
                <Card className="w-80 max-w-full">
                    <EmptyState
                        module="poker"
                        headingLevel="h3"
                        title={t('No story to estimate')}
                        description={t(
                            'Import tickets from Jira or Linear, or add a story by hand.',
                        )}
                        action={{ label: t('Import'), icon: Download }}
                        secondaryAction={{ label: t('Add a story') }}
                    />
                </Card>
            </Example>
        </div>
    );
}
