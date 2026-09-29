import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { FacilitatorMenu } from './facilitator-menu';
import { PhaseStepper } from './phase-stepper';
import { PresenceStrip } from './presence-strip';
import { TimerControl } from './timer-control';
import { TimerDisplay } from './timer-display';

type Props = {
    online: PresenceMember[];
    actions?: ReactNode;
};

export function BoardHeader({ online, actions }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { board } = ctx;
    const offset = useServerOffset(board.serverTime);

    return (
        <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
            {board.links.team && (
                <Link
                    href={board.links.team}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('Back to the team')}
                >
                    <ArrowLeft className="size-5" />
                </Link>
            )}
            <h1 className="text-lg font-semibold">{board.retro.title}</h1>
            <PhaseStepper
                phase={board.retro.phase}
                onChanged={() => void ctx.refetch()}
            />
            <div className="ml-auto flex items-center gap-3">
                <TimerDisplay
                    key={board.retro.timerEndsAt ?? 'none'}
                    endsAt={board.retro.timerEndsAt}
                    offset={offset}
                />
                {actions}
                {board.viewer.isFacilitator && (
                    <>
                        {board.retro.phase !== 'completed' && <TimerControl />}
                        <FacilitatorMenu />
                    </>
                )}
                <PresenceStrip members={online} />
                {board.viewer.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}
