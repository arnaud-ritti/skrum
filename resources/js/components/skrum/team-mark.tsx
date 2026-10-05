import type { TeamMarkData } from '@/lib/invitations/types';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

const SizeClasses = {
    sm: 'size-7.5 rounded-md text-body-sm',
    md: 'size-10 rounded-md text-base',
} as const;

export function teamMarkData({
    name,
    color,
}: {
    name: string;
    color: ColumnColor;
}): TeamMarkData {
    const initial = Array.from(name.trim())[0] ?? '';

    return { name, initial: initial.toUpperCase(), color };
}

/** The team's initial on its colour (`.ob-mark` of the mockup); the name is said next to it. */
export function TeamMark({
    team,
    size = 'sm',
    className,
}: {
    team: TeamMarkData;
    size?: keyof typeof SizeClasses;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            data-slot="team-mark"
            className={cn(
                'grid shrink-0 place-items-center border border-(--col-border) bg-(--col) font-bold text-(--col-text)',
                `col-${team.color}`,
                SizeClasses[size],
                className,
            )}
        >
            {team.initial}
        </span>
    );
}
