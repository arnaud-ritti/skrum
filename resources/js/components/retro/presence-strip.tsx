import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';

const Visible = 8;

export function PresenceStrip({ members }: { members: PresenceMember[] }) {
    const { t } = useTrans();
    const hidden = members.length - Visible;

    return (
        <div
            role="group"
            className="flex items-center -space-x-2"
            aria-label={t(':count online', { count: members.length })}
        >
            {members.slice(0, Visible).map((member) => (
                <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                        <img
                            src={member.avatarUrl}
                            alt={member.name}
                            data-presence-id={member.id}
                            className="size-8 rounded-full border-2 border-background bg-muted"
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        {member.name}
                        {member.isGuest && ` · ${t('Guest')}`}
                    </TooltipContent>
                </Tooltip>
            ))}
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
