import { router, usePage } from '@inertiajs/react';
import { UserMinus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
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
    members: TeamMember[];
    availableMembers: TeamMember[];
    canManage: boolean;
    /** The roles a new member can be given; empty when the server sends none. */
    roleOptions?: TeamRoleOption[];
    /** Place left (IN-4): "Invite", at the end of the card header. */
    inviteAction?: ReactNode;
    /** Place left (TM-6): the role badge of a member, at the end of its row. */
    roleBadgeFor?: (member: TeamMember) => ReactNode;
};

const VisibleMembers = 6;

export function TeamMembersCard({
    workspaceSlug,
    team,
    members,
    availableMembers,
    canManage,
    roleOptions = [],
    inviteAction,
    roleBadgeFor,
}: Props) {
    const { t } = useTrans();
    const { errors } = usePage().props as {
        errors?: Record<string, string | undefined>;
    };
    const headingId = useId();
    const roleId = useId();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const memberLeft = useRef(false);
    const [expanded, setExpanded] = useState(false);
    const [removing, setRemoving] = useState<TeamMember | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState<TeamRole>('member');
    const [adding, setAdding] = useState(false);
    const params = { workspace: workspaceSlug, team: team.id };
    const visible = expanded ? members : members.slice(0, VisibleMembers);
    const hiddenCount = members.length - visible.length;

    // The "Remove" button of the row leaves with its member: the focus goes
    // to the heading of the card instead of falling back to the page.
    useEffect(() => {
        if (!confirming && memberLeft.current) {
            memberLeft.current = false;
            headingRef.current?.focus();
        }
    }, [confirming]);

    const remove = (member: TeamMember): Promise<void> =>
        new Promise((resolve) => {
            router.delete(
                TeamMembersController.destroy.url({
                    ...params,
                    member: member.id,
                }),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        memberLeft.current = true;
                    },
                    onFinish: () => resolve(),
                },
            );
        });

    const add = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (userId === '' || adding) {
            return;
        }

        router.post(
            TeamMembersController.store.url(params),
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
        <Card asChild>
            <section data-slot="team-members-card" aria-labelledby={headingId}>
                <CardHeader>
                    <h2
                        id={headingId}
                        ref={headingRef}
                        tabIndex={-1}
                        className="flex min-w-0 items-center gap-2 rounded-sm text-base leading-snug font-title outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <span className="truncate">{t('Members')}</span>
                        <Badge variant="muted" shape="pill">
                            {members.length}
                        </Badge>
                    </h2>
                    {inviteAction !== undefined && (
                        <CardAction>{inviteAction}</CardAction>
                    )}
                </CardHeader>
                <CardContent className="pt-2">
                    <ul data-slot="team-members" className="divide-y">
                        {visible.map((member) => (
                            <li
                                key={member.id}
                                className="flex min-w-0 items-center gap-3 py-2"
                            >
                                <PersonAvatar
                                    name={member.name}
                                    src={member.avatarUrl}
                                    decorative
                                />
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-semibold">
                                        {member.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {member.email}
                                    </span>
                                </div>
                                {roleBadgeFor?.(member)}
                                {canManage && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label={t('Remove person :name', {
                                            name: member.name,
                                        })}
                                        onClick={() => {
                                            setRemoving(member);
                                            setConfirming(true);
                                        }}
                                    >
                                        <UserMinus aria-hidden />
                                        <span className="truncate @max-card-wide/card:sr-only">
                                            {t('Remove from team')}
                                        </span>
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {hiddenCount > 0 && (
                        <Button
                            variant="link"
                            size="sm"
                            className="mt-2 px-0"
                            onClick={() => setExpanded(true)}
                        >
                            {t('Show :count more', { count: hiddenCount })}
                        </Button>
                    )}
                </CardContent>
                {canManage && availableMembers.length > 0 && (
                    <CardFooter>
                        <form
                            onSubmit={add}
                            className="flex w-full min-w-0 flex-col gap-1"
                        >
                            <div className="flex min-w-0 items-start gap-2">
                                <Select
                                    value={userId}
                                    onValueChange={setUserId}
                                >
                                    <SelectTrigger
                                        aria-label={t('Add a member')}
                                        className="min-w-0 flex-1"
                                    >
                                        <SelectValue
                                            placeholder={t('Add a member')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMembers.map((member) => (
                                            <SelectItem
                                                key={member.id}
                                                value={member.id}
                                            >
                                                {member.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {roleOptions.length > 0 && (
                                    <Select
                                        value={role}
                                        onValueChange={(value) =>
                                            setRole(value as TeamRole)
                                        }
                                    >
                                        <SelectTrigger
                                            id={roleId}
                                            aria-label={t('Add as')}
                                            aria-invalid={
                                                errors?.role !== undefined ||
                                                undefined
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
                    </CardFooter>
                )}

                <ConfirmDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    tone="destructive"
                    title={t('Remove :name from :team?', {
                        name: removing?.name ?? '',
                        team: team.name,
                    })}
                    description={t(
                        'They stay in the workspace and can be added back to the team.',
                    )}
                    confirmLabel={t('Remove from team')}
                    onConfirm={() =>
                        removing === null ? Promise.resolve() : remove(removing)
                    }
                />
            </section>
        </Card>
    );
}
