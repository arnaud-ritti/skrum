import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember, Snapshot } from '@/lib/retro/types';
import { PhaseStepper } from './phase-stepper';
import { PresenceStrip } from './presence-strip';

type Props = {
    board: Snapshot;
    online: PresenceMember[];
    actions?: ReactNode;
};

export function BoardHeader({ board, online, actions }: Props) {
    const { t } = useTrans();

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
            <PhaseStepper phase={board.retro.phase} />
            <div className="ml-auto flex items-center gap-3">
                {actions}
                <PresenceStrip members={online} />
                {board.viewer.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}
