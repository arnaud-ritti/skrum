import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ActionItem } from '@/components/skrum/action-item';
import type {
    ActionItemLink,
    ActionItemOwner,
    ActionItemProps,
} from '@/components/skrum/action-item';
import { ActionSheet } from '@/components/skrum/action-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const members: ActionItemOwner[] = [
    { id: 'u1', name: 'Ines Benali', presence: 9 },
    { id: 'u2', name: 'Malik Kaci', presence: 7 },
];

const jiraLink: ActionItemLink = {
    id: 'l1',
    source: 'jira',
    key: 'ATLAS-1287',
    url: 'https://example.com/ATLAS-1287',
};

const syncedLinks: ActionItemLink[] = [
    {
        ...jiraLink,
        state: 'open',
        statusName: 'In review',
        syncState: 'synced',
        lastSyncedAt: '2026-10-09T08:00:00Z',
    },
    {
        id: 'l2',
        source: 'linear',
        key: 'ENG-42',
        url: 'https://example.com/ENG-42',
        syncState: 'pending',
    },
    {
        id: 'l3',
        source: 'github',
        key: 'skrum#128',
        url: 'https://example.com/128',
        syncState: 'failed',
        syncError: 'Token expired',
    },
    {
        id: 'l4',
        source: 'jira_dc',
        key: 'PLATFORM-90412',
        url: 'https://example.com/PLATFORM-90412',
        syncState: 'missing',
    },
];

const sixLinks: ActionItemLink[] = [
    ...syncedLinks,
    {
        id: 'l5',
        source: 'github',
        key: 'design-system#2048',
        url: 'https://example.com/2048',
        state: 'done',
        syncState: 'synced',
    },
    {
        id: 'l6',
        source: 'linear',
        key: 'INFRASTRUCTURE-1024',
        url: 'https://example.com/INFRASTRUCTURE-1024',
    },
];

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

function Checklist({ count }: { count: number }) {
    const { t } = useTrans();

    return (
        <ul className="flex flex-col gap-1.5">
            {Array.from({ length: count }, (_, index) => (
                <li key={index}>
                    <Checkbox
                        defaultChecked={index < 5}
                        label={t('Sub-task :number', { number: index + 1 })}
                    />
                </li>
            ))}
        </ul>
    );
}

function ExportSlot() {
    const { t } = useTrans();

    return (
        <Button type="button" variant="ghost" size="sm" className="min-w-0">
            <Upload aria-hidden />
            <span className="truncate">{t('Export')}</span>
        </Button>
    );
}

export default function ActionItemSection() {
    const { t } = useTrans();
    const [sheetOpen, setSheetOpen] = useState(true);
    const [commentsOpen, setCommentsOpen] = useState(true);
    const [editing, setEditing] = useState(false);
    const title = t('Limit PRs to 400 lines and add a review template');
    const longTitle = t(
        'Rewrite the deployment checklist so that every release names an owner, a rollback plan, a communication channel and the dashboards to watch, then review it with the three squads before the end of the quarter and archive the previous versions in the team space for the yearly audit.',
    );
    const longName =
        'Maximilienne-Alexandrine de La Rochefoucauld-Montmorency-Laval';
    const base: ActionItemProps = {
        title,
        status: 'open',
        priority: 'high',
        dueDate: '2099-10-10',
        today: '2026-10-10',
        source: { label: t('Sprint 42 retrospective') },
        owner: members[0],
        links: [jiraLink],
        onStatusChange: () => {},
    };
    const subtasks = Array.from({ length: 12 }, (_, index) => ({
        isCompleted: index < 5,
    }));
    const thread = (
        <p className="text-body-sm text-muted-foreground">
            {t('The comment thread is rendered here by the page.')}
        </p>
    );

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
                        links={[syncedLinks[1]]}
                    />
                </Example>
                <Example label={t('Overdue')}>
                    <ActionItem
                        {...base}
                        dueDate="2026-09-26"
                        overdue
                        links={null}
                    />
                </Example>
                <Example label={t('Done, low priority, completed in Jira')}>
                    <ActionItem
                        {...base}
                        status="completed"
                        priority="low"
                        doneAt="2026-09-22"
                        completedVia="jira"
                    />
                </Example>
                <Example label={t('No owner, no ticket, no due date')}>
                    <ActionItem
                        {...base}
                        priority="low"
                        owner={null}
                        links={null}
                        dueDate={null}
                        source={undefined}
                        onLinkTicket={() => {}}
                    />
                </Example>
                <Example
                    label={t(
                        'Manager view: edit, delete, export, sub-tasks, comments, sync states',
                    )}
                >
                    <ActionItem
                        {...base}
                        id="action-item-bench"
                        editing={editing}
                        members={members}
                        recurrence="every_two_weeks"
                        followUpDate="2026-09-12"
                        createdBy={{ name: 'Malik Kaci' }}
                        themeName={t('Code review')}
                        teamName={t('Platform team')}
                        source={{
                            label: t('Sprint 42 retrospective'),
                            url: '#',
                        }}
                        showOwnerName
                        links={syncedLinks}
                        subtasks={subtasks}
                        commentCount={3}
                        commentsOpen={commentsOpen}
                        comments={thread}
                        actions={<ExportSlot />}
                        onToggleComments={() => setCommentsOpen(!commentsOpen)}
                        onEditStart={() => setEditing(true)}
                        onEditCancel={() => setEditing(false)}
                        onChange={() => setEditing(false)}
                        onDelete={() => {}}
                        onRetrySync={() => {}}
                    >
                        <Checklist count={12} />
                    </ActionItem>
                </Example>
                <Example
                    label={t('Read only: cannot complete, guest assignee')}
                >
                    <ActionItem
                        {...base}
                        canComplete={false}
                        owner={{ id: 'p1', name: 'Zoe Martin', kind: 'guest' }}
                        showOwnerName
                        createdBy={null}
                        commentCount={1}
                    />
                </Example>
                <Example label={t('Saving')}>
                    <ActionItem
                        {...base}
                        busy
                        onEditStart={() => {}}
                        onDelete={() => {}}
                    />
                </Example>
                <Example label={t('Inline editing')}>
                    <ActionItem
                        {...base}
                        editing
                        members={members}
                        recurrence="weekly"
                        onChange={() => {}}
                        onEditCancel={() => {}}
                    />
                </Example>
                <Example
                    label={t(
                        'Extreme data: 280-character title, 60-character name, 12 sub-tasks, 6 links',
                    )}
                >
                    <ActionItem
                        {...base}
                        title={longTitle}
                        owner={{ id: 'u9', name: longName }}
                        showOwnerName
                        createdBy={{ name: longName }}
                        themeName={longName}
                        teamName={longName}
                        recurrence="every_two_weeks"
                        followUpDate="2026-09-12"
                        links={sixLinks}
                        subtasks={subtasks}
                        commentCount={200}
                        onToggleComments={() => {}}
                        onEditStart={() => {}}
                        onDelete={() => {}}
                        onRetrySync={() => {}}
                        actions={<ExportSlot />}
                    />
                </Example>
                <Example label={t('Narrow container (20rem)')} width="w-80">
                    <ActionItem {...base} />
                </Example>
                <Example label={t('Narrow container, overdue')} width="w-80">
                    <ActionItem {...base} dueDate="2026-09-26" />
                </Example>
                <Example
                    label={t('Narrow container, extreme data')}
                    width="w-80"
                >
                    <ActionItem
                        {...base}
                        title={longTitle}
                        owner={{ id: 'u9', name: longName }}
                        showOwnerName
                        themeName={longName}
                        recurrence="every_two_weeks"
                        links={sixLinks}
                        subtasks={subtasks}
                        commentCount={200}
                        onToggleComments={() => {}}
                        onEditStart={() => {}}
                        onDelete={() => {}}
                        onRetrySync={() => {}}
                        actions={<ExportSlot />}
                    />
                </Example>
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        {t(
                            'Action sheet: open, overdue, one field saving, extreme data',
                        )}
                    </p>
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSheetOpen(true)}
                        >
                            <span className="truncate">
                                {t('Open the action sheet')}
                            </span>
                        </Button>
                    </div>
                </div>
                <ActionSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    title={longTitle}
                    status="open"
                    priority="high"
                    dueDate="2026-09-26"
                    overdue
                    today="2026-10-10"
                    savingField="priority"
                    owner={{ id: 'u9', name: longName, isTeamMember: false }}
                    members={members}
                    createdBy={{ name: longName }}
                    themeName={longName}
                    teamName={t('Platform team')}
                    source={{ label: t('Sprint 42 retrospective'), url: '#' }}
                    recurrence="every_two_weeks"
                    followUpDate="2026-09-12"
                    links={sixLinks}
                    subtasks={subtasks}
                    commentCount={200}
                    comments={thread}
                    watchers={members}
                    actions={<ExportSlot />}
                    onStatusChange={() => {}}
                    onChange={() => {}}
                    onDelete={() => {}}
                    onRetrySync={() => {}}
                >
                    <Checklist count={12} />
                </ActionSheet>
            </div>
        </TooltipProvider>
    );
}
