import { Link } from '@inertiajs/react';
import { ArrowLeft, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { GameSwitcher } from './game-switcher';
import { HistoryDrawer } from './history-drawer';
import { useRoom } from './room-context';
import { RoomInviteButton } from './room-invite-button';
import { RoomMenu } from './room-menu';
import { RoomTimer } from './room-timer';

export function RoomHeader() {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const { room, me, links } = snapshot;
    const gameLabel =
        snapshot.games.find((option) => option.value === room.game)?.label ??
        room.game;

    const copyGuestLink = async () => {
        if (room.guestUrl === null) {
            return;
        }

        try {
            await navigator.clipboard.writeText(room.guestUrl);
            toast(t('Link copied'));
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            {links.team && (
                <Link
                    href={links.team}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('Back to the team')}
                >
                    <ArrowLeft className="size-5" />
                </Link>
            )}
            <h1 className="text-lg font-semibold">{room.name}</h1>
            {room.isHost ? (
                <GameSwitcher />
            ) : (
                <Badge variant="outline">{gameLabel}</Badge>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-3">
                <RoomTimer />
                <HistoryDrawer />
                {room.guestUrl !== null && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Copy guest link')}
                        onClick={() => void copyGuestLink()}
                    >
                        <Link2 className="size-4" />
                    </Button>
                )}
                <RoomInviteButton />
                <RoomMenu />
                <PresenceStrip members={online} />
                {me.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}
