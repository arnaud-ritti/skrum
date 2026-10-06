import { Link } from '@inertiajs/react';
import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { useTrans } from '@/hooks/use-trans';
import { firstLetter } from '@/lib/utils';
import type { TeamMember, TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: Pick<TeamMember, 'name' | 'avatarUrl'>[];
    /** The one "New session" trigger of the page, with its dialog. */
    newSession?: ReactNode;
    /** The sprint and the next retro, at the end of the line under the name. */
    schedule?: ReactNode;
};

const StackedMembers = 4;

export function TeamHeader({
    workspace,
    team,
    members,
    newSession,
    schedule,
}: Props) {
    const { t } = useTrans();
    const membersLabel =
        members.length === 1
            ? t('1 member')
            : t(':count members', { count: members.length });

    return (
        <header
            data-slot="team-header"
            className="flex flex-wrap items-center gap-x-5 gap-y-4"
        >
            <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-skrum-col-coral-border bg-skrum-col-coral font-display text-2xl font-bold text-skrum-col-coral-text"
            >
                {firstLetter(team.name)}
            </span>
            <div className="flex min-w-48 flex-1 flex-col gap-1">
                <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                    {team.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-muted-foreground *:whitespace-nowrap">
                    <Link
                        href={TeamMembersController.index.url({
                            workspace: workspace.slug,
                            team: team.id,
                        })}
                        aria-label={membersLabel}
                        className="inline-flex items-center gap-2 rounded-sm outline-ring hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        {members.length > 0 && (
                            <AvatarStack
                                size="xs"
                                max={StackedMembers}
                                people={members
                                    .slice(0, StackedMembers)
                                    .map((member) => ({
                                        name: member.name,
                                        src: member.avatarUrl,
                                    }))}
                            />
                        )}
                        <span>{membersLabel}</span>
                    </Link>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Building2 aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {t(':name workspace', { name: workspace.name })}
                        </span>
                    </span>
                    {schedule}
                </div>
            </div>
            {newSession !== undefined && (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {newSession}
                </div>
            )}
        </header>
    );
}
