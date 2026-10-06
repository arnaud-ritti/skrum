import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import InputError from '@/components/input-error';
import { LoadingButton } from '@/components/skrum/loading-button';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
    WorkspaceSummary,
} from '@/types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspace: WorkspaceSummary;
    team: TeamSummary;
    /** Members of the workspace who are not in the team. */
    availableMembers: TeamMember[];
    /** The roles a new member can be given; empty when the server sends none. */
    roleOptions?: TeamRoleOption[];
};

type Errors = Partial<Record<'user_id' | 'role', string>>;

function AddMemberForm({
    onOpenChange,
    workspace,
    team,
    availableMembers,
    roleOptions = [],
}: Omit<Props, 'open'>) {
    const { t } = useTrans();
    const memberId = useId();
    const roleId = useId();
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState<TeamRole>('member');
    const [errors, setErrors] = useState<Errors>({});
    const [adding, setAdding] = useState(false);

    const invalid = (id: string, error?: string) =>
        error === undefined
            ? {}
            : { 'aria-invalid': true, 'aria-describedby': `${id}-error` };

    const add = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (userId === '' || adding) {
            return;
        }

        router.post(
            TeamMembersController.store.url({
                workspace: workspace.slug,
                team: team.id,
            }),
            roleOptions.length > 0
                ? { user_id: userId, role }
                : { user_id: userId },
            {
                preserveScroll: true,
                onStart: () => setAdding(true),
                onSuccess: () => onOpenChange(false),
                onError: setErrors,
                onFinish: () => setAdding(false),
            },
        );
    };

    return (
        <form onSubmit={add} noValidate className="grid min-w-0 gap-4">
            <DialogHeader className="pr-8">
                <DialogTitle>{t('Add a member')}</DialogTitle>
                <DialogDescription>
                    {t('Someone already in :workspace joins this team.', {
                        workspace: workspace.name,
                    })}
                </DialogDescription>
            </DialogHeader>
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={memberId}>{t('Member')}</Label>
                <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger
                        id={memberId}
                        className="w-full"
                        {...invalid(memberId, errors.user_id)}
                    >
                        <SelectValue placeholder={t('Pick a member')} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                                <PersonAvatar
                                    decorative
                                    size="xs"
                                    name={member.name}
                                    src={member.avatarUrl}
                                />
                                <span className="truncate">
                                    {member.name}{' '}
                                    <span className="text-muted-foreground">
                                        {member.email}
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError
                    id={`${memberId}-error`}
                    role="alert"
                    message={errors.user_id}
                />
            </div>
            {roleOptions.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={roleId}>{t('Role')}</Label>
                    <Select
                        value={role}
                        onValueChange={(value) => setRole(value as TeamRole)}
                    >
                        <SelectTrigger
                            id={roleId}
                            className="w-full"
                            {...invalid(roleId, errors.role)}
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
                    <InputError
                        id={`${roleId}-error`}
                        role="alert"
                        message={errors.role}
                    />
                </div>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                >
                    {t('Cancel')}
                </Button>
                <LoadingButton
                    type="submit"
                    loading={adding}
                    disabled={userId === ''}
                >
                    {t('Add')}
                </LoadingButton>
            </DialogFooter>
        </form>
    );
}

/**
 * Adds someone who is already in the workspace to the team, without an
 * invitation. The form lives in the dialog's content, so each opening starts
 * empty.
 */
export function AddMemberDialog({ open, onOpenChange, ...form }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent closeLabel={t('Close')}>
                <AddMemberForm onOpenChange={onOpenChange} {...form} />
            </DialogContent>
        </Dialog>
    );
}
