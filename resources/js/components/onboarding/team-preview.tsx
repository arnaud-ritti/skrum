import { ChevronsUpDown } from 'lucide-react';
import type { OnboardingStepId } from '@/components/onboarding/onboarding-header';
import { OnboardingStepIds } from '@/components/onboarding/onboarding-header';
import { TeamMark, teamMarkData } from '@/components/skrum/team-mark';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';

type Translate = ReturnType<typeof useTrans>['t'];

function comingNext(step: OnboardingStepId, t: Translate): string {
    switch (step) {
        case 'workspace':
            return t('Name your workspace');
        case 'team':
            return t('Create your first team');
        case 'invite':
            return t('Invite your teammates by email or link');
        case 'ritual':
            return t('Pick a first ritual — a retro takes 2 minutes to set up');
    }
}

function GhostSession({ widths }: { widths: [string, string] }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-sm border border-dashed border-input p-3">
            <Skeleton className={`h-2.5 animate-none ${widths[0]}`} />
            <Skeleton className={`h-2 animate-none ${widths[1]}`} />
        </div>
    );
}

/**
 * The aside's live preview (`.ob-preview`): the team as the sidebar's
 * switcher and the team page will show it, then the steps still to come.
 */
export function TeamPreview({
    step,
    team,
    workspaceName,
    membersCount,
    invitedCount,
}: {
    step: OnboardingStepId;
    team: { name: string; color: ColumnColor; address: string };
    workspaceName: string;
    membersCount: number;
    invitedCount: number;
}) {
    const { t } = useTrans();
    const name = team.name.trim() === '' ? t('Team') : team.name;
    const mark = teamMarkData({ name, color: team.color });
    const members =
        membersCount <= 1
            ? t('1 member')
            : t(':count members', { count: membersCount });
    const subtitle =
        workspaceName.trim() === '' ? members : `${workspaceName} · ${members}`;
    const remaining = OnboardingStepIds.slice(
        OnboardingStepIds.indexOf(step) + 1,
    );

    return (
        <div
            data-slot="team-preview"
            className="flex w-96 max-w-full min-w-0 flex-col gap-4"
        >
            <span className="text-overline text-muted-foreground uppercase">
                {t('Preview')}
            </span>
            <div className="flex w-64 max-w-full min-w-0 items-center gap-2 rounded-lg bg-card p-2 shadow-raised">
                <TeamMark team={mark} />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span
                        data-slot="team-preview-name"
                        className="truncate text-sm font-semibold"
                    >
                        {name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {subtitle}
                    </span>
                </span>
                <ChevronsUpDown
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
                <div className="flex min-w-0 items-center gap-3 border-b p-4">
                    <TeamMark team={mark} size="md" />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-display text-base font-semibold">
                            {name}
                        </span>
                        <span
                            data-slot="team-preview-address"
                            className="truncate text-xs text-muted-foreground"
                        >
                            {team.address}
                        </span>
                    </span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                    <GhostSession widths={['w-3/5', 'w-2/5']} />
                    <GhostSession widths={['w-1/2', 'w-7/10']} />
                    <span className="text-center text-xs text-muted-foreground">
                        {t('No sessions yet')}
                    </span>
                    {invitedCount > 0 && (
                        <span
                            data-slot="team-preview-invited"
                            className="text-center text-xs text-muted-foreground"
                        >
                            {invitedCount === 1
                                ? t('1 pending invitation')
                                : t(':count pending invitations', {
                                      count: invitedCount,
                                  })}
                        </span>
                    )}
                </div>
            </div>
            {remaining.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border bg-card/80 p-4">
                    <span className="text-sm font-medium">
                        {t('Coming next')}
                    </span>
                    <ol className="flex flex-col gap-2">
                        {remaining.map((next) => (
                            <li
                                key={next}
                                className="flex min-w-0 items-center gap-3"
                            >
                                <span
                                    aria-hidden="true"
                                    className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
                                >
                                    {OnboardingStepIds.indexOf(next) + 1}
                                </span>
                                <span className="min-w-0 text-sm">
                                    {comingNext(next, t)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
