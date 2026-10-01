import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';

export function TopBar({
    state,
    children,
}: {
    state: WhiteboardState;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const { board, links } = state.snapshot;

    return (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
            {links.team && (
                <Button asChild size="icon" variant="ghost">
                    <Link href={links.team} aria-label={t('Back to the team')}>
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
            )}
            <h1 className="min-w-0 flex-1 truncate font-medium">
                {board.title}
            </h1>
            <PresenceStrip members={state.online} />
            {children}
        </header>
    );
}
