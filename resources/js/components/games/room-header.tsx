import {
    Brush,
    CloudSun,
    Film,
    MessageCircleQuestion,
    Smile,
    UserRoundPlus,
    UserRoundSearch,
    VenetianMask,
    WholeWord,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import GameTimerExtensionsController from '@/actions/App/Http/Controllers/Games/GameTimerExtensionsController';
import GameTimersController from '@/actions/App/Http/Controllers/Games/GameTimersController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LeaveSessionDialog } from '@/components/session/leave-session-dialog';
import { SessionTimer } from '@/components/session/session-timer';
import { SessionTitle } from '@/components/session/session-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameKind, GameRound } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';
import { RoomMenu } from './room-menu';
import { RoomShareDialog } from './room-share-dialog';
import { useCloseRound } from './use-close-round';

const gameIcons: Record<GameKind, LucideIcon> = {
    hangman: WholeWord,
    draw: Brush,
    gif: Film,
    decoded: Smile,
    two_truths: VenetianMask,
    mood: CloudSun,
    guess_who: UserRoundSearch,
    quick_question: MessageCircleQuestion,
};

const ExtensionSeconds = 120;

/** The games whose host ends a round by closing its votes, as CloseGameRound accepts. */
const VotingGames: readonly GameKind[] = ['gif', 'guess_who'];

/** The host ends a round from outside its stage only once its votes are open. */
function isClosable(round: GameRound | null): round is GameRound {
    return (
        round !== null &&
        round.revealedAt !== null &&
        VotingGames.includes(round.game)
    );
}

/** The room's name under "team · Games", with its way back to the team and the game in play. */
export function RoomTitle() {
    const { snapshot, online } = useRoom();
    const { t } = useTrans();
    const { close } = useCloseRound();
    const [leaving, setLeaving] = useState(false);
    const { room, games, links } = snapshot;
    const kind = room.isIcebreaker ? t('Icebreaker') : t('Games');
    const overline =
        room.teamName === null ? kind : `${room.teamName} · ${kind}`;
    const gameLabel =
        games.find((option) => option.value === room.game)?.label ?? room.game;
    const GameIcon = gameIcons[room.game];
    const { round } = snapshot;
    const roundCount =
        round !== null && round.number !== null && round.roundsTotal !== null
            ? t('Round :number / :total', {
                  number: round.number,
                  total: round.roundsTotal,
              })
            : null;

    const teamHref = links.team;
    const asksBeforeLeaving =
        teamHref !== null && room.isHost && isClosable(round);

    return (
        <>
            <SessionTitle
                backHref={teamHref}
                onBack={asksBeforeLeaving ? () => setLeaving(true) : undefined}
                overline={overline}
                badges={
                    <>
                        <Badge
                            variant="soft"
                            shape="pill"
                            data-slot="room-game"
                            className="hidden sm:inline-flex"
                        >
                            <GameIcon aria-hidden />
                            {gameLabel}
                        </Badge>
                        {roundCount !== null && (
                            <Badge
                                variant="outline"
                                shape="pill"
                                data-slot="room-round"
                                className="hidden sm:inline-flex"
                            >
                                {roundCount}
                            </Badge>
                        )}
                    </>
                }
            >
                {room.name}
            </SessionTitle>
            {asksBeforeLeaving && (
                <LeaveSessionDialog
                    open={leaving}
                    onOpenChange={setLeaving}
                    title={room.name ?? gameLabel}
                    peopleCount={online.length}
                    backHref={teamHref}
                    onEnd={async () => {
                        if (!(await close(round.id))) {
                            throw new Error('The round did not end.');
                        }
                    }}
                />
            )}
        </>
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
