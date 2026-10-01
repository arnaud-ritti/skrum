import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ActionItem } from '@/components/skrum/action-item';
import type { ActionItemProps } from '@/components/skrum/action-item';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({
    label,
    width,
    children,
}: {
    label: string;
    width?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className={width ?? 'w-full'} role="list">
                {children}
            </div>
        </div>
    );
}

export default function ActionItemSection() {
    const { t } = useTrans();
    const title = t('Limit PRs to 400 lines and add a review template');
    const base: ActionItemProps = {
        id: 'a',
        title,
        status: 'open',
        priority: 'high',
        dueDate: '2099-10-10',
        today: '2026-10-10',
        source: { retroId: 'r', label: t('Sprint 42 retrospective') },
        owner: { id: 'u1', name: 'Ines Benali', presence: 9 },
        ticket: {
            provider: 'jira',
            key: 'ATLAS-1287',
            url: 'https://example.com/ATLAS-1287',
        },
        onStatusChange: () => {},
        onLinkTicket: () => {},
    };
    const members = [
        { id: 'u1', name: 'Ines Benali', presence: 9 as const },
        { id: 'u2', name: 'Malik Kaci', presence: 7 as const },
    ];

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-8 p-4 md:p-6">
                <Example label={t('To do, high priority, Jira ticket')}>
                    <ActionItem {...base} />
                </Example>
                <Example
                    label={t('In progress, medium priority, Linear ticket')}
                >
                    <ActionItem
                        {...base}
                        status="doing"
                        withDoing
                        priority="medium"
                        ticket={{
                            provider: 'linear',
                            key: 'ENG-42',
                            url: 'https://example.com/ENG-42',
                        }}
                    />
                </Example>
                <Example label={t('Overdue')}>
                    <ActionItem {...base} dueDate="2026-09-26" ticket={null} />
                </Example>
                <Example label={t('Done, low priority')}>
                    <ActionItem
                        {...base}
                        status="completed"
                        priority="low"
                        doneAt="2026-09-22"
                        ticket={null}
                    />
                </Example>
                <Example label={t('No owner, no ticket, no due date')}>
                    <ActionItem
                        {...base}
                        priority="low"
                        owner={null}
                        ticket={null}
                        dueDate={null}
                        source={undefined}
                    />
                </Example>
                <Example label={t('Inline editing')}>
                    <ActionItem
                        {...base}
                        editing
                        members={members}
                        onChange={() => {}}
                        onEditCancel={() => {}}
                    />
                </Example>
                <Example label={t('Narrow container (20rem)')} width="w-80">
                    <ActionItem {...base} />
                </Example>
                <Example label={t('Narrow container, overdue')} width="w-80">
                    <ActionItem {...base} dueDate="2026-09-26" />
                </Example>
            </div>
        </TooltipProvider>
    );
}
