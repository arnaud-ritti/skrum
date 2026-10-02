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
import { ActionSheet } from '@/components/skrum/action-sheet';
import type { ActionSheetField } from '@/components/skrum/action-sheet';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { canManageActionItem } from '@/lib/action-items/permissions';
import type { ActionItem } from '@/lib/retro/types';

type Props = {
    /** The item shown; the sheet keeps it while it closes. */
    item: ActionItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context: ActionItemRowContext;
    endpoints: ActionItemEndpoints;
    /** The item was deleted in another browser while the sheet was open. */
    deleted?: boolean;
    onPatch: (item: ActionItem, patch: ActionItemPatch) => void;
};

const patchFields: [keyof ActionItemPatch, ActionSheetField][] = [
    ['title', 'title'],
    ['priority', 'priority'],
    ['dueDate', 'dueDate'],
    ['owner', 'owner'],
    ['recurrence', 'recurrence'],
];

/** The field a change of the sheet saves; clearing the date also clears the repeat. */
export function savedField(patch: ActionItemPatch): ActionSheetField | null {
    return patchFields.find(([key]) => patch[key] !== undefined)?.[1] ?? null;
}

/**
 * The details of an action item in a side sheet: every field, the sub-tasks,
 * the links to the trackers and the comments. A viewer who manages the item
 * edits it; one who may only complete it gets the status alone.
 */
export function ActionItemSheet({
    item,
    open,
    onOpenChange,
    context,
    endpoints,
    deleted = false,
    onPatch,
}: Props) {
    const [field, setField] = useState<ActionSheetField | null>(null);
    const { canComplete, ...data } = toActionItemData(item, {
        locale: context.locale,
        viewer: context.viewer,
        teamName: context.teamName(item.teamId),
    });
    const manages = canManageActionItem(item, context.viewer);
    const busy = context.busyId === item.id;
    const sources = manages ? context.sourcesOf(item.teamId) : [];

    return (
        <ActionSheet
            {...data}
            open={open}
            onOpenChange={onOpenChange}
            today={context.today}
            readOnly={!manages && !canComplete}
            canComplete={canComplete && !busy}
            savingField={busy ? field : null}
            deleted={deleted}
            onStatusChange={(status) => {
                setField('status');
                context.onStatusChange(
                    item,
                    status === 'completed' ? 'completed' : 'open',
                );
            }}
            {...(manages && {
                members: context.membersOf(item.teamId),
                onChange: (patch: ActionItemPatch) => {
                    setField(savedField(patch));
                    onPatch(item, patch);
                },
                onDelete: () => context.onDelete(item),
                onRetrySync: (link: ActionItemLink) =>
                    context.onRetrySync(item, link),
                actions:
                    sources.length === 0 || deleted ? undefined : (
                        <ItemExport
                            item={item}
                            sources={sources}
                            scope={context.scope}
                        />
                    ),
            })}
            comments={
                <ItemComments
                    item={item}
                    endpoints={endpoints}
                    revision={item.commentsRevision ?? 0}
                    viewer={context.viewer}
                    canWrite={!deleted}
                />
            }
        >
            {(manages || item.subtasks.length > 0) && (
                <ItemSubtasks
                    item={item}
                    endpoints={endpoints}
                    canManage={manages && !deleted}
                    canComplete={canComplete && !deleted}
                />
            )}
        </ActionSheet>
    );
}
