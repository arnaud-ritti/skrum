import { actionOwnerValue } from '@/components/skrum/action-item';
import type {
    ActionItemData,
    ActionItemOwner,
    ActionItemPatch,
    ActionItemSourceRef,
} from '@/components/skrum/action-item';
import { assigneePayload, assigneeValue } from '@/lib/action-items/assignees';
import { formatShortDate } from '@/lib/action-items/format';
import { canCompleteActionItem } from '@/lib/action-items/permissions';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import type {
    ActionItem,
    ActionItemAssignee,
    ActionItemPriority,
    ActionItemRecurrence,
} from '@/lib/retro/types';

type ActionItemContext = {
    locale: string;
    teamName?: string;
    viewer: ActionItemViewer;
    /**
     * Left out, the source is the retro of the item; a string replaces its
     * label (the topic on the board); `null` hides it.
     */
    sourceLabel?: string | null;
};

export type NewActionItem = {
    title: string;
    priority: ActionItemPriority;
    dueDate: string | null;
    recurrence: ActionItemRecurrence | null;
    owner: ActionItemOwner | null;
    /** The lead card of the topic the item is created for (RT-8). */
    cardId?: string;
};

export function toActionItemOwner(
    assignee: ActionItemAssignee | null,
): ActionItemOwner | null {
    if (assignee === null) {
        return null;
    }

    return {
        id: assignee.id,
        name: assignee.name,
        kind: assignee.kind,
        isTeamMember: assignee.isTeamMember,
        avatarUrl: assignee.avatarUrl,
    };
}

function sourceOf(
    item: ActionItem,
    { locale, sourceLabel }: ActionItemContext,
): ActionItemSourceRef | null {
    if (sourceLabel === null) {
        return null;
    }

    if (item.source === null) {
        return sourceLabel === undefined ? null : { label: sourceLabel };
    }

    const { retroTitle, retroCreatedAt, retroUrl } = item.source;
    const datedTitle = retroCreatedAt
        ? `${retroTitle} · ${formatShortDate(retroCreatedAt, locale)}`
        : retroTitle;

    return {
        label: sourceLabel ?? datedTitle,
        url: retroUrl,
        ...(item.retroId === null ? {} : { retroId: item.retroId }),
    };
}

/**
 * The handlers and the list of members stay with the container: it passes
 * them only to a viewer who manages the item.
 */
export function toActionItemData(
    item: ActionItem,
    context: ActionItemContext,
): ActionItemData & { canComplete: boolean } {
    return {
        title: item.content,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueOn,
        overdue: item.isOverdue,
        doneAt: item.completedAt,
        completedVia: item.completedVia,
        owner: toActionItemOwner(item.assignee),
        createdBy: item.createdBy,
        themeName: item.themeName,
        teamName: context.teamName ?? null,
        source: sourceOf(item, context),
        recurrence: item.recurrence,
        followUpDate: item.previousOccurrenceId ? item.createdAt : null,
        subtasks: item.subtasks.map(({ isCompleted }) => ({ isCompleted })),
        commentCount: item.commentCount,
        links: item.externalLinks,
        locale: context.locale,
        canComplete: canCompleteActionItem(item, context.viewer),
    };
}

/**
 * The editors of the components send every field on save; the server gets
 * only the ones that changed, and no request at all for none.
 */
export function patchToPayload(
    patch: ActionItemPatch,
    item: ActionItem,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const title = patch.title?.trim() ?? '';

    if (title !== '' && title !== item.content) {
        payload.content = title;
    }

    if (patch.priority !== undefined && patch.priority !== item.priority) {
        payload.priority = patch.priority;
    }

    const dueOn =
        patch.dueDate === undefined
            ? item.dueOn
            : (patch.dueDate?.slice(0, 10) ?? null);

    if (dueOn !== item.dueOn) {
        payload.due_on = dueOn;
    }

    const recurrence =
        dueOn === null
            ? null
            : patch.recurrence === undefined
              ? item.recurrence
              : patch.recurrence;

    if (recurrence !== item.recurrence) {
        payload.recurrence = recurrence;
    }

    if (
        patch.owner !== undefined &&
        actionOwnerValue(patch.owner) !== assigneeValue(item.assignee)
    ) {
        Object.assign(payload, assigneePayload(actionOwnerValue(patch.owner)));
    }

    return payload;
}

export function newItemToPayload(
    values: NewActionItem,
): Record<string, unknown> {
    return {
        content: values.title.trim(),
        priority: values.priority,
        due_on: values.dueDate,
        recurrence: values.dueDate === null ? null : values.recurrence,
        ...assigneePayload(actionOwnerValue(values.owner)),
        ...(values.cardId === undefined ? {} : { card_id: values.cardId }),
    };
}

export function ownerOptions(
    members: { id: string; name: string; avatarUrl?: string | null }[],
): ActionItemOwner[] {
    return members.map((member) => ({
        id: member.id,
        name: member.name,
        kind: 'member',
        isTeamMember: true,
        avatarUrl: member.avatarUrl ?? null,
    }));
}
