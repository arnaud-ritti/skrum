import { useState } from 'react';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ItemComments } from '@/components/action-items/item-comments';
import { ItemExport } from '@/components/action-items/item-export';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import type {
    ActionItemLink,
    ActionItemPatch,
} from '@/components/skrum/action-item';
import { ActionItem } from '@/components/skrum/action-item';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import type { ActionItemGroup } from '@/lib/action-items/grouping';
import { canManageActionItem } from '@/lib/action-items/permissions';
import type { ActionItem as ActionItemPayload } from '@/lib/retro/types';

type Props = {
    groups: ActionItemGroup[];
    context: ActionItemRowContext;
    endpoints: ActionItemEndpoints;
    /** The list has more than one page: a group counts the rows of this one. */
    paged?: boolean;
    /** The item of a deep link: its comments are open when the page loads. */
    focusedId?: string | null;
    'aria-label'?: string;
    onPatch: (item: ActionItemPayload, patch: ActionItemPatch) => void;
};

/**
 * The action items of a page below the width of the table: one `ActionItem`
 * per row, edited in place, with its sub-tasks and its comments under it.
 */
export function ActionItemsList({
    groups,
    context,
    endpoints,
    paged = false,
    focusedId = null,
    'aria-label': ariaLabel,
    onPatch,
}: Props) {
    const { t } = useTrans();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openComments, setOpenComments] = useState<Set<string>>(
        () => new Set(focusedId === null ? [] : [focusedId]),
    );

    const toggleComments = (itemId: string): void =>
        setOpenComments((current) => {
            const next = new Set(current);

            if (!next.delete(itemId)) {
                next.add(itemId);
            }

            return next;
        });

    const countLabel = (count: number): string => {
        const label =
            count === 1
                ? t('1 action item')
                : t(':count action items', { count });

        return paged ? `${label} · ${t('on this page')}` : label;
    };

    const row = (item: ActionItemPayload) => {
        const { canComplete, ...data } = toActionItemData(item, {
            locale: context.locale,
            viewer: context.viewer,
            teamName: context.showTeam
                ? context.teamName(item.teamId)
                : undefined,
        });
        const manages = canManageActionItem(item, context.viewer);
        const sources = manages ? context.sourcesOf(item.teamId) : [];

        return (
            <ActionItem
                key={item.id}
                id={`action-item-${item.id}`}
                {...data}
                today={context.today}
                withDoing
                showOwnerName
                meta={
                    item.source === null && (
                        <span>{t('Added outside a retro')}</span>
                    )
                }
                canComplete={canComplete}
                busy={context.busyId === item.id}
                editing={manages && editingId === item.id}
                commentsOpen={openComments.has(item.id)}
                onToggleComments={() => toggleComments(item.id)}
                comments={
                    <ItemComments
                        item={item}
                        endpoints={endpoints}
                        revision={item.commentsRevision ?? 0}
                        viewer={context.viewer}
                    />
                }
                onStatusChange={(status) =>
                    context.onStatusChange(item, status)
                }
                {...(manages && {
                    members: context.membersOf(item.teamId),
                    onEditStart: () => setEditingId(item.id),
                    onEditCancel: () => setEditingId(null),
                    onChange: (patch: ActionItemPatch) => {
                        setEditingId(null);
                        onPatch(item, patch);
                    },
                    onDelete: () => context.onDelete(item),
                    onRetrySync: (link: ActionItemLink) =>
                        context.onRetrySync(item, link),
                    actions:
                        sources.length === 0 ? undefined : (
                            <ItemExport
                                item={item}
                                sources={sources}
                                scope={context.scope}
                            />
                        ),
                })}
            >
                {(manages || item.subtasks.length > 0) && (
                    <ItemSubtasks
                        item={item}
                        endpoints={endpoints}
                        canManage={manages}
                        canComplete={canComplete}
                    />
                )}
            </ActionItem>
        );
    };

    return (
        <div
            data-slot="action-items-list"
            aria-label={ariaLabel}
            role={ariaLabel ? 'group' : undefined}
            className="flex min-w-0 flex-col gap-5"
        >
            {groups.map((group) => (
                <section
                    key={group.key}
                    data-slot="action-group"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {group.label !== '' && (
                        <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                            <span className="min-w-0 wrap-anywhere">
                                {group.label}
                            </span>
                            <span className="font-medium text-muted-foreground">
                                {countLabel(group.items.length)}
                            </span>
                        </h2>
                    )}
                    <div role="list" className="flex min-w-0 flex-col gap-2">
                        {group.items.map(row)}
                    </div>
                </section>
            ))}
        </div>
    );
}
