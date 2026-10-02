import type { ActionItemAssignee } from '@/lib/retro/types';

const Unassigned = 'none';

export function assigneeValue(assignee: ActionItemAssignee | null): string {
    if (assignee === null) {
        return Unassigned;
    }

    return `${assignee.kind}:${assignee.id}`;
}

/**
 * Members travel as users and guests as participants; the workspace
 * endpoints refuse a non-empty participant id.
 */
export function assigneePayload(value: string): {
    assignee_user_id: string | null;
    assignee_participant_id: string | null;
} {
    if (value === Unassigned) {
        return { assignee_user_id: null, assignee_participant_id: null };
    }

    const [kind, id] = value.split(':');

    if (kind === 'guest') {
        return { assignee_user_id: null, assignee_participant_id: id };
    }

    return { assignee_user_id: id, assignee_participant_id: null };
}
