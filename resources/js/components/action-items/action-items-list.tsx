import { useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { ActionItemGroupMeta } from '@/components/action-items/action-item-group-meta';
import { toActionItemData } from '@/components/action-items/action-item-adapters';
import { ActionItemSelectCell } from '@/components/action-items/action-item-select-cell';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ItemComments } from '@/components/action-items/item-comments';
import { ItemExport } from '@/components/action-items/item-export';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import { useLongPress } from '@/components/action-items/use-long-press';
import type { LongPressHandlers } from '@/components/action-items/use-long-press';
import type { ActionItemSelection } from '@/components/action-items/use-action-item-selection';
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
import { cn } from '@/lib/utils';

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
    /** The page's selection; without it the list has no selection mode. */
    selection?: ActionItemSelection;
    /** Selection mode (spec 24 §9.5): a box before each item, a tap toggles it. */
    selecting?: boolean;
    /** A long press of a finger or a pen, outside selection mode. */
    onLongPress?: (item: ActionItemPayload) => void;
};

type RowProps = LongPressHandlers & {
    onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => void;
    'data-selected'?: 'true';
    className?: string;
};

/**
 * One item of the list with what selection adds to it: the long press
 * outside the mode, and in the mode a box before it and a tap that toggles
 * it instead of reaching the item's own buttons.
 */
function SelectableRow({
    item,
    selection,
    selecting,
    onLongPress,
    render,
}: {
    item: ActionItemPayload;
    selection: ActionItemSelection;
    selecting: boolean;
    onLongPress?: (item: ActionItemPayload) => void;
    render: (props: RowProps) => ReactNode;
}) {
    const press = useLongPress(() => {
        if (!selecting) {
            onLongPress?.(item);
        }
    });
    const selected = selecting && selection.isSelected(item.id);

    const onClickCapture = (event: MouseEvent<HTMLElement>): void => {
        press.onClickCapture(event);

        if (!selecting || event.isPropagationStopped()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (selection.selectable(item)) {
            selection.toggle(item.id);
        }
    };

    // Space and Enter on the focused item select it, as a tap does.
    const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>): void => {
        if (!selecting || event.target !== event.currentTarget) {
            return;
        }

        if (event.key !== ' ' && event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (selection.selectable(item)) {
            selection.toggle(item.id);
        }
    };

    const row = render({
        ...press,
        onClickCapture,
        onKeyDownCapture,
        'data-selected': selected ? 'true' : undefined,
        className: cn(
            selecting && 'min-w-0 flex-1 cursor-pointer select-none',
            'data-[selected=true]:border-ring data-[selected=true]:bg-skrum-primary-soft',
        ),
    });

    if (!selecting) {
        return row;
    }

    return (
        <div
            data-slot="action-item-selectable"
            className="flex min-w-0 items-start gap-1"
        >
            <span className="grid size-11 shrink-0 place-items-center">
                <ActionItemSelectCell
                    item={item}
                    selection={selection}
                    className="size-5"
                />
            </span>
            {row}
        </div>
    );
}

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
    selection,
    selecting = false,
    onLongPress,
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

    const row = (item: ActionItemPayload, selectionProps?: RowProps) => {
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
                {...selectionProps}
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
                            <ActionItemGroupMeta
                                group={group}
                                countLabel={countLabel}
                            />
                        </h2>
                    )}
                    <div role="list" className="flex min-w-0 flex-col gap-2">
                        {group.items.map((item) =>
                            selection === undefined ? (
                                row(item)
                            ) : (
                                <SelectableRow
                                    key={item.id}
                                    item={item}
                                    selection={selection}
                                    selecting={selecting}
                                    onLongPress={onLongPress}
                                    render={(props) => row(item, props)}
                                />
                            ),
                        )}
                    </div>
                </section>
            ))}
        </div>
    );
}
