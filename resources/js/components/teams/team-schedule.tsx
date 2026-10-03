import { Link, usePage } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { nextRetroLabel, sprintTitle } from '@/lib/teams/sprint';
import type { TeamSchedule } from '@/types';

type Props = {
    /** The current sprint and the next retro; null when there is neither. */
    schedule: TeamSchedule | null;
    /** Where the first sprint is started, for who may set the rituals of a team without sprints. */
    startFirstSprintHref?: string;
};

/** The end of the line under the team name: "Sprint 42 · Next retro Thu 2 Oct, 2 pm". */
export function TeamScheduleLine({ schedule, startFirstSprintHref }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (startFirstSprintHref !== undefined) {
        return (
            <Button
                data-slot="team-schedule"
                variant="ghost"
                size="sm"
                className="-my-1"
                asChild
            >
                <Link href={startFirstSprintHref}>
                    <CalendarDays aria-hidden />
                    {t('Start the first sprint')}
                </Link>
            </Button>
        );
    }

    if (schedule === null) {
        return null;
    }

    const parts = [
        schedule.sprint === null ? null : sprintTitle(schedule.sprint, t),
        schedule.nextRetro === null
            ? null
            : nextRetroLabel(schedule.nextRetro, locale, t),
    ].filter((part) => part !== null);

    if (parts.length === 0) {
        return null;
    }

    return (
        <span
            data-slot="team-schedule"
            className="inline-flex min-w-0 items-center gap-1.5"
        >
            <CalendarDays aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{parts.join(' · ')}</span>
        </span>
    );
}
