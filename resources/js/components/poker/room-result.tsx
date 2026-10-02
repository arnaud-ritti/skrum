import { usePage } from '@inertiajs/react';
import { PokerResultBar } from '@/components/skrum/poker-result-bar';
import type { PokerResultLayout } from '@/components/skrum/poker-result-bar';
import { useTrans } from '@/hooks/use-trans';
import { seatsFrom, storyFrom } from '@/lib/poker/room-adapters';
import { useGame } from './game-context';
import type { RoundActions } from './use-round-actions';

/** Id of the result heading: the browser suite finds the result section by it. */
const ResultId = 'poker-result';

type Props = {
    /**
     * `bar` in the dock of a wide screen. On a phone the result is a `card`
     * in the flow of the stage and its two buttons stay in the dock (`foot`).
     */
    layout: PokerResultLayout;
    actions: RoundActions;
    className?: string;
};

/**
 * The result of the revealed round: the agreement, the distribution and who
 * opens the discussion for everyone; the final-estimate cards, "Validate" and
 * "Re-vote" for the facilitator of a game that is not ended. The average, the
 * median and the spread are in the oval of the table.
 */
export function RoomResult({ layout, actions, className }: Props) {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { game, me, current } = snapshot;
    const round = current?.round ?? null;
    const task = snapshot.tasks.find(
        (candidate) => candidate.id === current?.taskId,
    );

    if (round === null || round.revealedAt === null || !task) {
        return null;
    }

    const onlineIds = new Set(online.map((member) => member.id));

    return (
        <PokerResultBar
            key={round.id}
            layout={layout}
            headingId={ResultId}
            result={round.result}
            seats={seatsFrom(snapshot, onlineIds)}
            story={storyFrom(task)}
            anonymous={round.anonymous}
            revealReason={round.revealReason}
            locale={locale}
            isNumeric={game.isNumeric}
            status={
                round.myVote !== null ? (
                    <span data-slot="poker-dock-status" className="min-w-0">
                        {t('Your card')}
                        {' · '}
                        <strong className="font-semibold text-foreground">
                            {round.myVote}
                        </strong>
                    </span>
                ) : undefined
            }
            isFacilitator={me.isFacilitator && game.endedAt === null}
            busy={actions.busy}
            estimate={actions.estimate}
            estimateValues={actions.estimateCards}
            hasNext={actions.next !== null}
            onEstimateChange={actions.chooseEstimate}
            onValidate={(value) => void actions.validate(value)}
            onRevote={() => void actions.revote()}
            className={className}
        />
    );
}
