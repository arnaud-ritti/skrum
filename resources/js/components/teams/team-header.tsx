import { Link } from '@inertiajs/react';
import { Building2, Gamepad2, ListChecks, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { TeamMember, TeamSummary, WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: TeamMember[];
    openActionItemCount: number;
    /**
     * Where the "Team settings" entry of the sidebar leads; the gear is left
     * out for who can change nothing of the team.
     */
    settingsHref?: string;
    /** The one "New session" trigger of the page, with its dialog. */
    newSession?: ReactNode;
    /** Place left (TM-1): the sprint and the next retro, at the end of the line under the name. */
    schedule?: ReactNode;
};

const StackedMembers = 4;

/**
 * "Open action items (7)" is one sentence for translators and for assistive
 * technology; the count is drawn as a badge when the sentence ends with it.
 */
export function splitCount(label: string): { text: string; count?: string } {
    const match = /^(.*\S)\s*\((\d+)\)$/u.exec(label);

    return match === null
        ? { text: label }
        : { text: match[1], count: match[2] };
}

export function TeamHeader({
    workspace,
    team,
    members,
    openActionItemCount,
    settingsHref,
    newSession,
    schedule,
}: Props) {
    const { t } = useTrans();
    const params = { workspace: workspace.slug, team: team.id };
    const actionItems = splitCount(
        t('Open action items (:count)', { count: openActionItemCount }),
    );

    return (
        <header
            data-slot="team-header"
            className="flex flex-wrap items-center gap-x-5 gap-y-4"
        >
            <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-skrum-col-coral-border bg-skrum-col-coral font-display text-2xl font-bold text-skrum-col-coral-text"
            >
                {team.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-48 flex-1 flex-col gap-1">
                <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                    {team.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-muted-foreground *:whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
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
                        {members.length === 1
                            ? t('1 member')
                            : t(':count members', { count: members.length })}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        <Building2 aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {t(':name workspace', { name: workspace.name })}
                        </span>
                    </span>
                    {schedule}
                </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button variant="outline" asChild>
                    <Link
                        href={WorkspaceActionItemsController.index(
                            workspace.slug,
                            { query: { team: team.id } },
                        )}
                    >
                        <ListChecks aria-hidden />
                        <span className="truncate">{actionItems.text}</span>
                        {actionItems.count !== undefined && (
                            <>
                                {' '}
                                <Badge variant="soft" shape="pill">
                                    <span className="sr-only">(</span>
                                    {actionItems.count}
                                    <span className="sr-only">)</span>
                                </Badge>
                            </>
                        )}
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href={TeamGameRoomsController.index(params)}>
                        <Gamepad2 aria-hidden />
                        <span className="truncate">{t('Games')}</span>
                    </Link>
                </Button>
                {settingsHref !== undefined && (
                    <Button variant="outline" size="icon" asChild>
                        <Link
                            href={settingsHref}
                            aria-label={t('Team settings')}
                        >
                            <Settings aria-hidden />
                        </Link>
                    </Button>
                )}
                {newSession}
            </div>
        </header>
    );
}
