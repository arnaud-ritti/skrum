import { Link, usePage } from '@inertiajs/react';
import { DoorOpen, Plus, UserPlus, Users } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import { TeamSection } from '@/components/teams/team-section';
import { Button } from '@/components/ui/button';
import {
    LeaveWorkspaceDialog,
    LeaveWorkspacePanel,
} from '@/components/workspaces/leave-workspace-dialog';
import { NewTeamDialog } from '@/components/workspaces/new-team-dialog';
import { TeamTile } from '@/components/workspaces/team-tile';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type {
    WorkspaceRole,
    WorkspaceSummary,
    WorkspaceTeamTile,
} from '@/types';

export type WorkspaceOverviewProps = {
    workspace: WorkspaceSummary;
    teams: WorkspaceTeamTile[];
    membersCount: number;
    adminsCount: number;
    otherAdminName: string | null;
    canManage: boolean;
};

/**
 * Places left for the features that come after the rewrite; nothing is
 * rendered while a slot is undefined.
 */
export type WorkspaceOverviewSlots = {
    /** WS-1: the description of a team, under its name on the tile. */
    teamDescriptionFor?: (team: WorkspaceTeamTile) => ReactNode;
};

export function WorkspaceOverview({
    workspace,
    teams,
    membersCount,
    adminsCount,
    otherAdminName,
    canManage,
    role,
    now,
    slots = {},
}: WorkspaceOverviewProps & {
    /** Role of the viewer in this workspace, when the page knows it. */
    role?: WorkspaceRole;
    /** The present, in milliseconds; given by the bench for a stable picture. */
    now?: number;
    slots?: WorkspaceOverviewSlots;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isPhone = useIsMobile();
    const leaveHeadingId = useId();
    const leaveTrigger = useRef<HTMLButtonElement>(null);
    const [newTeamOpen, setNewTeamOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [present] = useState(() => now ?? Date.now());

    const roleLine =
        role === undefined
            ? undefined
            : {
                  owner: t("you're the owner"),
                  admin: t("you're an admin"),
                  member: t("you're a member"),
              }[role];

    const subline = [
        teams.length === 1
            ? t('1 team')
            : t(':count teams', { count: teams.length }),
        membersCount === 1
            ? t('1 member')
            : t(':count members', { count: membersCount }),
        roleLine,
    ]
        .filter((part) => part !== undefined)
        .join(' · ');

    const changeLeaveOpen = (open: boolean): void => {
        setLeaveOpen(open);

        if (!open) {
            leaveTrigger.current?.focus();
        }
    };

    const leave = {
        open: leaveOpen,
        onOpenChange: changeLeaveOpen,
        workspace,
        teams: teams.filter((team) => team.isMember).map((team) => team.name),
        adminsCount: canManage ? adminsCount : undefined,
        otherAdminName,
    };

    return (
        <div
            data-slot="workspace-overview"
            className="flex min-w-0 flex-col gap-8"
        >
            <header
                data-slot="workspace-header"
                className="flex flex-wrap items-center gap-x-5 gap-y-4"
            >
                <span
                    aria-hidden
                    className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-display text-2xl font-bold text-sidebar-primary-foreground"
                >
                    {workspace.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                        {workspace.name}
                    </h1>
                    <p
                        data-slot="workspace-subline"
                        className="text-sm text-muted-foreground"
                    >
                        {subline}
                    </p>
                </div>
                {canManage && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link
                                href={WorkspaceMembersController.index(
                                    workspace.slug,
                                )}
                            >
                                <UserPlus aria-hidden />
                                <span className="truncate">
                                    {t('Invite people')}
                                </span>
                            </Link>
                        </Button>
                        <Button onClick={() => setNewTeamOpen(true)}>
                            <Plus aria-hidden />
                            <span className="truncate">{t('New team')}</span>
                        </Button>
                    </div>
                )}
            </header>

            <TeamSection
                icon={Users}
                title={t('Teams')}
                count={teams.length}
                actions={
                    <Button variant="link" size="sm" asChild>
                        <Link
                            href={WorkspaceTemplatesController.index(
                                workspace.slug,
                            )}
                        >
                            <span className="truncate">
                                {canManage
                                    ? t('Manage templates')
                                    : t('View templates')}
                            </span>
                        </Link>
                    </Button>
                }
            >
                {teams.length === 0 && (
                    <p
                        data-slot="workspace-teams-empty"
                        className="text-sm text-muted-foreground"
                    >
                        {canManage
                            ? t('No teams yet. Create the first one.')
                            : t('You are not a member of any team yet.')}
                    </p>
                )}
                {(teams.length > 0 || canManage) && (
                    <div
                        data-slot="workspace-teams"
                        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15.5rem),1fr))] gap-4"
                    >
                        {teams.map((team) => (
                            <TeamTile
                                key={team.id}
                                team={team}
                                href={TeamsController.show({
                                    workspace: workspace.slug,
                                    team: team.id,
                                })}
                                locale={locale}
                                now={present}
                                description={slots.teamDescriptionFor?.(team)}
                            />
                        ))}
                        {canManage && (
                            <button
                                type="button"
                                data-slot="new-team-tile"
                                onClick={() => setNewTeamOpen(true)}
                                className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input p-6 text-center text-muted-foreground outline-ring transition-colors duration-140 ease-standard hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                            >
                                <Plus aria-hidden className="size-6" />
                                <span className="font-semibold text-foreground">
                                    {t('New team')}
                                </span>
                                <span className="text-xs">
                                    {t(
                                        'Teams share the templates of this workspace.',
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </TeamSection>

            <section
                aria-labelledby={leaveHeadingId}
                data-slot="workspace-leave"
                className="flex flex-col gap-4 border-t pt-6"
            >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                    <div className="flex min-w-0 flex-1 basis-80 flex-col gap-0.5">
                        <h2
                            id={leaveHeadingId}
                            className="text-sm font-semibold"
                        >
                            {t('Leave workspace')}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                "You'll lose access to its teams, sessions and templates. Your action items stay assigned until someone reassigns them.",
                            )}
                        </p>
                    </div>
                    <Button
                        ref={leaveTrigger}
                        variant="ghost"
                        size="sm"
                        aria-expanded={isPhone ? undefined : leaveOpen}
                        aria-haspopup="dialog"
                        onClick={() => changeLeaveOpen(!leaveOpen)}
                        className="text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
                    >
                        <DoorOpen aria-hidden />
                        <span className="truncate">
                            {t('Leave workspace…')}
                        </span>
                    </Button>
                </div>
                {isPhone && <LeaveWorkspaceDialog {...leave} />}
                {!isPhone && leaveOpen && <LeaveWorkspacePanel {...leave} />}
            </section>

            {canManage && (
                <NewTeamDialog
                    open={newTeamOpen}
                    onOpenChange={setNewTeamOpen}
                    workspaceSlug={workspace.slug}
                />
            )}
        </div>
    );
}
