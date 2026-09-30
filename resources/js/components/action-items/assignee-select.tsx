import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { Unassigned } from '@/lib/action-items/assignees';
import type { ActionItemAssignee, Snapshot } from '@/lib/retro/types';

type Translate = ReturnType<typeof useTrans>['t'];

export type AssigneeOption = { value: string; label: string };

export type AssigneeGroup = { label: string; options: AssigneeOption[] };

export function assigneeLabel(
    assignee: ActionItemAssignee,
    t: Translate,
): string {
    if (assignee.kind === 'guest') {
        return t(':name (guest)', { name: assignee.name });
    }

    if (!assignee.isTeamMember) {
        return t(':name (not in team)', { name: assignee.name });
    }

    return assignee.name;
}

/**
 * Guests of this retro and the members who joined it first, then the rest
 * of the team. Workspace admins outside the team cannot be assigned.
 */
export function boardAssigneeGroups(
    board: Snapshot,
    t: Translate,
): AssigneeGroup[] {
    const guests = board.participants
        .filter((participant) => participant.isGuest)
        .map((participant) => ({
            value: `guest:${participant.id}`,
            label: t(':name (guest)', { name: participant.name }),
        }));
    const joined = board.teamMembers
        .filter((member) => member.participantId !== null)
        .map((member) => ({
            value: `member:${member.id}`,
            label: member.name,
        }));
    const others = board.teamMembers
        .filter((member) => member.participantId === null)
        .map((member) => ({
            value: `member:${member.id}`,
            label: member.name,
        }));

    return [
        { label: t('In this retro'), options: [...joined, ...guests] },
        { label: t('Team'), options: others },
    ];
}

export function teamAssigneeGroups(
    members: Array<{ id: string; name: string }>,
    t: Translate,
): AssigneeGroup[] {
    return [
        {
            label: t('Team'),
            options: members.map((member) => ({
                value: `member:${member.id}`,
                label: member.name,
            })),
        },
    ];
}

type Props = {
    value: string;
    groups: AssigneeGroup[];
    current?: ActionItemAssignee | null;
    disabled?: boolean;
    onChange: (value: string) => void;
};

export function AssigneeSelect({
    value,
    groups,
    current,
    disabled,
    onChange,
}: Props) {
    const { t } = useTrans();
    const isListed = groups.some((group) =>
        group.options.some((option) => option.value === value),
    );

    return (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Assignee')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={Unassigned}>{t('Unassigned')}</SelectItem>
                {!isListed && current && (
                    <SelectItem value={value} disabled>
                        {assigneeLabel(current, t)}
                    </SelectItem>
                )}
                {groups
                    .filter((group) => group.options.length > 0)
                    .map((group) => (
                        <SelectGroup key={group.label}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {group.options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
            </SelectContent>
        </Select>
    );
}
