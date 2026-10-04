import { useState } from 'react';
import type { ReactNode } from 'react';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import { ItemComments } from '@/components/action-items/item-comments';
import { ItemExport } from '@/components/action-items/item-export';
import type { IntegrationScope } from '@/components/action-items/item-export';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import type { useActionItemMutations } from '@/components/action-items/use-action-item-mutations';
import { ActionItem } from '@/components/skrum/action-item';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { canManageActionItem } from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem as ActionItemPayload } from '@/lib/retro/types';
import type { ExportSource } from '@/types/integrations';

type Props = {
    items: ActionItemPayload[];
    endpoints: ActionItemEndpoints;
    mutations: ReturnType<typeof useActionItemMutations>;
    viewer: ActionItemViewer;
    /** Nothing can be changed while the board is closed for editing. */
    editable: boolean;
    members: ActionItemOwner[];
    scope: IntegrationScope | null;
    exportSources: ExportSource[];
    locale: string;
    showAnonymousNotice: boolean;
    /** The DOM id of a row; the comment thread takes it with "-comments". */
    idFor: (item: ActionItemPayload) => string;
    /**
     * `null` hides where an item comes from; left out, an item names its
     * retro.
     */
    sourceLabel?: null;
    classNameFor?: (item: ActionItemPayload) => string | undefined;
    /** Place of what a page says of an item, such as its topic (RT-8). */
    metaFor?: (item: ActionItemPayload) => ReactNode;
    onDelete: (item: ActionItemPayload) => void;
};

/**
 * The rows of a list of action items on the board, each with its sub-tasks,
 * its comments and its export. They read their endpoints from the
 * `ActionItemMutationsContext` around them.
 */
export function ActionItemRows({
    items,
    endpoints,
    mutations,
    viewer,
    editable,
    members,
    scope,
    exportSources,
    locale,
    showAnonymousNotice,
    idFor,
    sourceLabel,
    classNameFor,
    metaFor,
    onDelete,
}: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openComments, setOpenComments] = useState<Set<string>>(new Set());

    const toggleComments = (itemId: string): void =>
        setOpenComments((current) => {
            const next = new Set(current);

            if (!next.delete(itemId)) {
                next.add(itemId);
            }

            return next;
        });

    return (
        <div role="list" className="flex min-w-0 flex-col gap-2">
            {items.map((item) => {
                const { canComplete, ...data } = toActionItemData(item, {
                    locale,
                    viewer,
                    ...(sourceLabel === null && { sourceLabel }),
                });
                const manages = editable && canManageActionItem(item, viewer);
                const completes = editable && canComplete;

                return (
                    <ActionItem
                        key={item.id}
                        id={idFor(item)}
                        {...data}
                        showOwnerName
                        className={classNameFor?.(item)}
                        meta={metaFor?.(item)}
                        canComplete={completes}
                        busy={mutations.busyId === item.id}
                        editing={manages && editingId === item.id}
                        commentsOpen={openComments.has(item.id)}
                        onToggleComments={() => toggleComments(item.id)}
                        comments={
                            <ItemComments
                                item={item}
                                endpoints={endpoints}
                                revision={item.commentsRevision ?? 0}
                                viewer={viewer}
                                canWrite={editable}
                                showAnonymousNotice={showAnonymousNotice}
                            />
                        }
                        onStatusChange={(status) =>
                            void mutations.setStatus(item, status)
                        }
                        {...(manages && {
                            members,
                            onEditStart: () => setEditingId(item.id),
                            onEditCancel: () => setEditingId(null),
                            onChange: (patch) => {
                                setEditingId(null);
                                void mutations.patch(item, patch);
                            },
                            onDelete: () => onDelete(item),
                            onRetrySync: (link) =>
                                void mutations.retrySync(item, link),
                            actions:
                                scope === null ? undefined : (
                                    <ItemExport
                                        item={item}
                                        sources={exportSources}
                                        scope={scope}
                                    />
                                ),
                        })}
                    >
                        {(manages || item.subtasks.length > 0) && (
                            <ItemSubtasks
                                item={item}
                                endpoints={endpoints}
                                canManage={manages}
                                canComplete={completes}
                            />
                        )}
                    </ActionItem>
                );
            })}
        </div>
    );
}
