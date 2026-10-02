import {
    CopyIcon,
    FolderInputIcon,
    Link2Icon,
    ListChecksIcon,
    MergeIcon,
    MoreHorizontalIcon,
    PencilIcon,
    Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Button } from '@/components/ui/button';
import {
    CardMenu,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

function Trigger({
    label,
    ...props
}: { label: string } & ComponentProps<typeof Button>) {
    return (
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
            <MoreHorizontalIcon />
        </Button>
    );
}

export default function DropdownMenuSection() {
    const { t } = useTrans();
    const [column, setColumn] = useState('improve');
    const [showAuthors, setShowAuthors] = useState(true);
    const [showReactions, setShowReactions] = useState(true);
    const [showOthersVotes, setShowOthersVotes] = useState(false);
    const [sort, setSort] = useState('votes');
    const noop = () => {};

    const cardActions: MenuEntry[] = [
        { type: 'label', label: t("Sofia L.'s card") },
        {
            type: 'item',
            label: t('Edit'),
            icon: PencilIcon,
            shortcut: 'E',
            onSelect: noop,
        },
        {
            type: 'item',
            label: t('Merge with…'),
            icon: MergeIcon,
            shortcut: '⌘M',
            onSelect: noop,
        },
        {
            type: 'sub',
            label: t('Move to'),
            icon: FolderInputIcon,
            items: [
                {
                    type: 'radio',
                    value: column,
                    onValueChange: setColumn,
                    items: [
                        { value: 'well', label: t('Went well') },
                        { value: 'improve', label: t('To improve') },
                        { value: 'ideas', label: t('Ideas') },
                        { value: 'questions', label: t('Questions') },
                    ],
                },
            ],
        },
        {
            type: 'item',
            label: t('Duplicate'),
            icon: CopyIcon,
            shortcut: '⌘D',
            onSelect: noop,
        },
        { type: 'separator' },
        {
            type: 'item',
            label: t('Create an action'),
            icon: ListChecksIcon,
            onSelect: noop,
        },
        {
            type: 'item',
            label: t('Link to Jira'),
            icon: Link2Icon,
            disabled: true,
            disabledReason: t('Not configured'),
            onSelect: noop,
        },
        { type: 'separator' },
        {
            type: 'item',
            label: t('Delete'),
            icon: Trash2Icon,
            shortcut: '⌫',
            tone: 'danger',
            onSelect: noop,
        },
    ];

    const lockedActions: MenuEntry[] = [
        {
            type: 'item',
            label: t('Edit'),
            icon: PencilIcon,
            disabled: true,
            disabledReason: t(':name is writing', { name: 'Inès' }),
            onSelect: noop,
        },
        {
            type: 'item',
            label: t('Merge with…'),
            icon: MergeIcon,
            disabled: true,
            disabledReason: t(':name is writing', { name: 'Inès' }),
            onSelect: noop,
        },
        {
            type: 'item',
            label: t('Duplicate'),
            icon: CopyIcon,
            shortcut: '⌘D',
            onSelect: noop,
        },
    ];

    const displayOptions: MenuEntry[] = [
        { type: 'label', label: t('Show on cards') },
        {
            type: 'checkbox',
            label: t('Authors'),
            checked: showAuthors,
            onCheckedChange: setShowAuthors,
        },
        {
            type: 'checkbox',
            label: t('Reactions'),
            checked: showReactions,
            onCheckedChange: setShowReactions,
        },
        {
            type: 'checkbox',
            label: t("Others' votes"),
            checked: showOthersVotes,
            onCheckedChange: setShowOthersVotes,
        },
        { type: 'separator' },
        { type: 'label', label: t('Sort by') },
        {
            type: 'radio',
            value: sort,
            onValueChange: setSort,
            items: [
                { value: 'votes', label: t('Votes') },
                { value: 'date', label: t('Date added') },
            ],
        },
    ];

    return (
        <div className="@container grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <State
                label={t(
                    'Card actions: shortcuts, sub-menu, disabled with reason, danger last',
                )}
            >
                <div>
                    <CardMenu
                        defaultOpen
                        trigger={<Trigger label={t('Card actions')} />}
                        entries={cardActions}
                        label={t('Card actions')}
                    />
                </div>
            </State>
            <State label={t('Locked by someone else: disabled with a reason')}>
                <div>
                    <CardMenu
                        trigger={<Trigger label={t('Locked card actions')} />}
                        entries={lockedActions}
                        label={t('Locked card actions')}
                    />
                </div>
            </State>
            <State label={t('Checkboxes and radios')}>
                <div>
                    <CardMenu
                        trigger={<Trigger label={t('Display options')} />}
                        entries={displayOptions}
                        label={t('Display options')}
                    />
                </div>
            </State>
            <State label={t('Two-line items: the row grows with its content')}>
                <div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('Notifications')}
                            >
                                <MoreHorizontalIcon />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            className="w-72"
                            aria-label={t('Notifications')}
                        >
                            {[
                                t(
                                    'Sofia assigned you the action "Write the incident review before the next planning"',
                                ),
                                t('Retro sprint 42 starts in 10 minutes'),
                            ].map((title) => (
                                <DropdownMenuItem
                                    key={title}
                                    className="flex flex-col items-start gap-0.5"
                                >
                                    <span className="break-words">{title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('Atlas · 2 days ago')}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </State>
            <State label={t('Aligned to start')}>
                <div>
                    <CardMenu
                        align="start"
                        trigger={<Trigger label={t('Start-aligned menu')} />}
                        entries={lockedActions}
                        label={t('Start-aligned menu')}
                    />
                </div>
            </State>
        </div>
    );
}
