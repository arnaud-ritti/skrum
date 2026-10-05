import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { AddTeamMemberForm } from '@/components/teams/add-team-member-form';
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
import { useTrans } from '@/hooks/use-trans';
import type { TeamMember, TeamRoleOption, TeamSummary } from '@/types';

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
    const headingId = useId();
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? members : members.slice(0, VisibleMembers);
    const hiddenCount = members.length - visible.length;

    return (
        <Card asChild>
            <section data-slot="team-members-card" aria-labelledby={headingId}>
                <CardHeader>
                    <h2
                        id={headingId}
                        className="flex min-w-0 items-center gap-2 text-base leading-snug font-title"
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
                        <AddTeamMemberForm
                            workspaceSlug={workspaceSlug}
                            team={team}
                            availableMembers={availableMembers}
                            roleOptions={roleOptions}
                        />
                    </CardFooter>
                )}
            </section>
        </Card>
    );
}
