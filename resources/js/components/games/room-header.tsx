import { Brush, Film, Smile, UserRoundPlus, WholeWord } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import GameTimerExtensionsController from '@/actions/App/Http/Controllers/Games/GameTimerExtensionsController';
import GameTimersController from '@/actions/App/Http/Controllers/Games/GameTimersController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SessionTimer } from '@/components/session/session-timer';
import { SessionTitle } from '@/components/session/session-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
import { RoomMenu } from './room-menu';
import { RoomShareDialog } from './room-share-dialog';

const gameIcons: Record<GameKind, LucideIcon> = {
    hangman: WholeWord,
    draw: Brush,
    gif: Film,
    decoded: Smile,
};

const ExtensionSeconds = 120;

/** The room's name with its way back to the team and the game in play. */
export function RoomTitle() {
    const { snapshot } = useRoom();
    const { room, games, links } = snapshot;
    const gameLabel =
        games.find((option) => option.value === room.game)?.label ?? room.game;
    const GameIcon = gameIcons[room.game];

    return (
        <SessionTitle
            backHref={links.team}
            badges={
                <Badge
                    variant="soft"
                    shape="pill"
                    data-slot="room-game"
                    className="hidden sm:inline-flex"
                >
                    <GameIcon aria-hidden />
                    {gameLabel}
                </Badge>
            }
        >
            {room.name}
        </SessionTitle>
    );
}

/** The one timer of the room; only the host of a standalone room starts, stops and extends it. */
export function RoomTimer() {
    const ctx = useRoom();
    const [totalSeconds, setTotalSeconds] = useState<number>();
    const { room } = ctx.snapshot;
    const canSet = room.isHost && !room.isIcebreaker;

    const set = async (seconds: number | null) => {
        const response = await ctx.run(
            retroRequest<{ timerEndsAt: string | null }>(
                GameTimersController.update(room.id),
                { seconds },
            ),
        );

        if (!response) {
            return;
        }

        setTotalSeconds(seconds ?? undefined);
        ctx.apply({ type: 'timer.set', timerEndsAt: response.timerEndsAt });
    };

    const extend = async () => {
        const response = await ctx.run(
            retroRequest<{ timerEndsAt: string }>(
                GameTimerExtensionsController.store(room.id),
            ),
        );

        if (!response) {
            return;
        }

        setTotalSeconds((total) =>
            total === undefined ? undefined : total + ExtensionSeconds,
        );
        ctx.apply({ type: 'timer.set', timerEndsAt: response.timerEndsAt });
    };

    return (
        <SessionTimer
            endsAt={room.timerEndsAt}
            offset={ctx.serverOffset}
            totalSeconds={totalSeconds}
            alarm={false}
            onStart={canSet ? (seconds) => void set(seconds) : undefined}
            onStop={canSet ? () => void set(null) : undefined}
            onExtend={canSet ? () => void extend() : undefined}
        />
    );
}

/** Right end of the header: "Invite" for who manages the room, its menu, the guest's language. */
export function RoomActions() {
    const { snapshot, sessionExpired } = useRoom();
    const { t } = useTrans();
    const [sharing, setSharing] = useState(false);
    const { room, me } = snapshot;
    const canInvite = room.canManage && !room.isIcebreaker;

    return (
        <>
            {canInvite && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={t('Invite')}
                        disabled={sessionExpired}
                        onClick={() => setSharing(true)}
                    >
                        <UserRoundPlus aria-hidden />
                        <span className="hidden truncate md:inline">
                            {t('Invite')}
                        </span>
                    </Button>
                    <RoomShareDialog
                        open={sharing && !sessionExpired}
                        onOpenChange={setSharing}
                    />
                </>
            )}
            <RoomMenu />
            {me.isGuest && <LanguageSwitcher />}
        </>
    );
}
