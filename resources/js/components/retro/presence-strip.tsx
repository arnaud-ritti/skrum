import type { ReactNode } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';

const Visible = 8;

type Props = {
    members: PresenceMember[];
    badgeFor?: (member: PresenceMember) => ReactNode;
};

export function PresenceStrip({ members, badgeFor }: Props) {
    const { t } = useTrans();
    const hidden = members.length - Visible;

    return (
        <div
            role="group"
            className="flex items-center -space-x-2"
            aria-label={t(':count online', { count: members.length })}
        >
            {members.slice(0, Visible).map((member) => {
                const badge = badgeFor?.(member);

                return (
                    <Tooltip key={member.id}>
                        <TooltipTrigger asChild>
                            <span className="relative inline-flex">
                                <img
                                    src={member.avatarUrl}
                                    alt={member.name}
                                    data-presence-id={member.id}
                                    className="size-8 rounded-full border-2 border-background bg-muted"
                                />
                                {badge && (
                                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-background bg-muted">
                                        {badge}
                                    </span>
                                )}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {member.name}
                            {member.isGuest && ` · ${t('Guest')}`}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
            {hidden > 0 && (
                <span
                    aria-label={t(':count more', { count: hidden })}
                    className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs"
                >
                    +{hidden}
                </span>
            )}
        </div>
    );
}
