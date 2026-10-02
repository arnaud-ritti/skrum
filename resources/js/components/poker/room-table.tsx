import { usePage } from '@inertiajs/react';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/skrum/empty-state';
import { PokerTable } from '@/components/skrum/poker-table';
import type { PokerSeat } from '@/components/skrum/poker-table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { seatsFrom, storyFrom } from '@/lib/poker/room-adapters';
import type { PokerTask } from '@/lib/poker/types';
import { useGame } from './game-context';
import { TaskFormDialog } from './room-dialogs';
import { useSetSpectator } from './use-round-actions';
import type { RoundActions } from './use-round-actions';

/** The facilitator moves another player between the table and the watchers. */
function PlayerRoleMenu({ seat }: { seat: PokerSeat }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { busy, setSpectator } = useSetSpectator();
    const player = snapshot.players.find(
        (candidate) => candidate.id === seat.user.id,
    );
    // A spectator who voted before a named reveal keeps a seat: the role is
    // read from the player, not from the seat.
    const isWatching = player?.isSpectator ?? seat.state === 'watching';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-6"
                    aria-label={t('Player options')}
                >
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    disabled={busy}
                    onSelect={() =>
                        void setSpectator(seat.user.id, !isWatching)
                    }
                >
                    {isWatching ? t('Make player') : t('Make spectator')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** No task in the game yet: the call to add the first one. */
function NoTasks() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const canAdd = snapshot.me.canEditTasks && snapshot.game.endedAt === null;

    return (
        <>
            <EmptyState
                module="poker"
                title={t('Add the first task')}
                description={t(
                    'Tasks are estimated one at a time, in the order of the queue.',
                )}
                action={
                    canAdd
                        ? {
                              label: t('Add task'),
                              onClick: () => setAdding(true),
                          }
                        : undefined
                }
                className="my-auto"
            />
            <TaskFormDialog
                task={null}
                open={adding}
                onOpenChange={setAdding}
            />
        </>
    );
}

type Props = {
    task: PokerTask | null;
    actions: RoundActions;
    /** On a phone: the players in one row that scrolls sideways. */
    compact?: boolean;
};

/**
 * The table of the current round, or what to do when there is none. Once the
 * cards are revealed, the oval holds the average, the median and the spread;
 * the rest of the result is in the dock.
 */
export function RoomTable({ task, actions, compact = false }: Props) {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { game, me, current } = snapshot;
    const isEnded = game.endedAt !== null;
    if (snapshot.tasks.length === 0) {
        return <NoTasks />;
    }

    if (!current || !task) {
        return (
            <EmptyState
                module="poker"
                title={
                    me.isFacilitator
                        ? t('Pick a task to start voting')
                        : t('Waiting for the facilitator to pick a task')
                }
                description={
                    me.isFacilitator
                        ? t(
                              'Choose a task in the queue to open its first round.',
                          )
                        : t('The vote opens as soon as a task is picked.')
                }
                className="my-auto"
            />
        );
    }

    const { round } = current;
    const onlineIds = new Set(online.map((member) => member.id));
    const canFacilitate = me.isFacilitator && !isEnded;

    return (
        <PokerTable
            story={storyFrom(task)}
            showStory={false}
            seats={seatsFrom(snapshot, onlineIds)}
            revealed={round.revealedAt !== null}
            result={round.result}
            showResult={false}
            seatsLayout={compact ? 'row' : 'table'}
            anonymous={round.anonymous}
            revealReason={round.revealReason}
            facilitatorId={game.facilitatorPlayerId}
            locale={locale}
            isNumeric={game.isNumeric}
            isFacilitator={canFacilitate}
            busy={actions.busy}
            seatMenu={
                canFacilitate
                    ? (seat) =>
                          seat.user.id === me.playerId ? null : (
                              <PlayerRoleMenu seat={seat} />
                          )
                    : undefined
            }
            onReveal={canFacilitate ? () => void actions.reveal() : undefined}
            className="w-full max-w-5xl"
        />
    );
}
