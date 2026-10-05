import { router, usePage } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import { LoadingButton } from '@/components/skrum/loading-button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    TeamMember,
    TeamRole,
    TeamRoleOption,
    TeamSummary,
} from '@/types';

type Props = {
    workspaceSlug: string;
    team: TeamSummary;
    /** Members of the workspace who are not in the team. */
    availableMembers: TeamMember[];
    /** The roles a new member can be given; empty when the server sends none. */
    roleOptions?: TeamRoleOption[];
};

/** Adds someone who is already in the workspace to the team, without an invitation. */
export function AddTeamMemberForm({
    workspaceSlug,
    team,
    availableMembers,
    roleOptions = [],
}: Props) {
    const { t } = useTrans();
    const { errors } = usePage().props as {
        errors?: Record<string, string | undefined>;
    };
    const roleId = useId();
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState<TeamRole>('member');
    const [adding, setAdding] = useState(false);

    const add = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (userId === '' || adding) {
            return;
        }

        router.post(
            TeamMembersController.store.url({
                workspace: workspaceSlug,
                team: team.id,
            }),
            roleOptions.length > 0
                ? { user_id: userId, role }
                : { user_id: userId },
            {
                preserveScroll: true,
                onStart: () => setAdding(true),
                onSuccess: () => {
                    setUserId('');
                    setRole('member');
                },
                onFinish: () => setAdding(false),
            },
        );
    };

    return (
        <form onSubmit={add} className="flex w-full min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-start gap-2">
                <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger
                        aria-label={t('Add a member')}
                        className="min-w-0 flex-1"
                    >
                        <SelectValue placeholder={t('Add a member')} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                                {member.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {roleOptions.length > 0 && (
                    <Select
                        value={role}
                        onValueChange={(value) => setRole(value as TeamRole)}
                    >
                        <SelectTrigger
                            id={roleId}
                            aria-label={t('Add as')}
                            aria-invalid={
                                errors?.role !== undefined || undefined
                            }
                            aria-describedby={
                                errors?.role === undefined
                                    ? undefined
                                    : `${roleId}-error`
                            }
                            className="w-auto max-w-36 min-w-0 shrink-0"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {roleOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <LoadingButton
                    type="submit"
                    loading={adding}
                    disabled={userId === ''}
                >
                    {t('Add')}
                </LoadingButton>
            </div>
            {errors?.user_id && (
                <p
                    role="alert"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {errors.user_id}
                </p>
            )}
            {errors?.role && (
                <p
                    id={`${roleId}-error`}
                    role="alert"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {errors.role}
                </p>
            )}
        </form>
    );
}
