import { BellRing, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import RetroRotiNudgesController from '@/actions/App/Http/Controllers/Retros/RetroRotiNudgesController';
import RetroRotiRevealsController from '@/actions/App/Http/Controllers/Retros/RetroRotiRevealsController';
import { useTrans } from '@/hooks/use-trans';
import { isObserving } from '@/lib/retro/adapters';
import { retroRequest } from '@/lib/retro/api';
import type { RotiResults } from '@/lib/retro/types';
import { useBoard } from './board-context';
import type { RotiTools } from './facilitator-dock';
import { rotiVoters } from './phase-roti';

/** The server takes one nudge per 30 s and per retro. */
const NudgeIntervalMs = 30_000;

/** Two runs of `animate-nudge` (1.2 s each). */
const NudgePulseMs = 2_400;

/**
 * "Nudge the last n" and "Reveal ROTI" of the facilitator bar (RT-9). The
 * count leaves out the facilitator, whom a nudge never reaches. Both go
 * once the ROTI is revealed: the vote is closed.
 */
export function useRotiFacilitation(): RotiTools {
    const ctx = useBoard();
    const { t } = useTrans();
    const [nudging, setNudging] = useState(false);
    const [resting, setResting] = useState(false);
    const [revealing, setRevealing] = useState(false);
    const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { board, online } = ctx;
    const retroId = board.retro.id;

    useEffect(
        () => () => {
            if (restTimer.current) {
                clearTimeout(restTimer.current);
            }
        },
        [],
    );

    if (board.retro.phase !== 'roti' || board.roti.revealed) {
        return {};
    }

    const left = rotiVoters(board, online).filter(
        (voter) => !voter.hasVoted && !voter.isMe,
    ).length;

    const nudge = async () => {
        setNudging(true);

        const result = await ctx.run(
            retroRequest(RetroRotiNudgesController.store(retroId)),
        );

        setNudging(false);

        if (result === undefined) {
            return;
        }

        setResting(true);
        restTimer.current = setTimeout(
            () => setResting(false),
            NudgeIntervalMs,
        );
    };

    const reveal = async () => {
        setRevealing(true);

        const result = await ctx.run(
            retroRequest<{ results: RotiResults }>(
                RetroRotiRevealsController.update(retroId),
            ),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }

        setRevealing(false);
    };

    return {
        nudge: {
            id: 'nudge',
            label:
                left === 0
                    ? t('Everyone has voted')
                    : left === 1
                      ? t('Nudge the last one')
                      : t('Nudge the last :count', { count: left }),
            icon: BellRing,
            disabled: left === 0 || nudging || resting,
            onSelect: () => void nudge(),
        },
        reveal: {
            id: 'reveal',
            label: t('Reveal ROTI'),
            icon: Eye,
            disabled: revealing,
            onSelect: () => void reveal(),
        },
    };
}

/**
 * A nudge of the facilitator reaches a viewer who has not voted: a toast,
 * and true for one pulse of the widget. The facilitator is never nudged.
 */
export function useRotiNudgeToast(): boolean {
    const { board, subscribeRotiNudges } = useBoard();
    const { t } = useTrans();
    const [nudged, setNudged] = useState(false);
    const awaited =
        !isObserving(board) &&
        !board.viewer.isFacilitator &&
        board.roti.myScore === null;
    const latest = useRef({ awaited, message: t('Your ROTI vote is awaited') });

    useEffect(() => {
        latest.current = { awaited, message: t('Your ROTI vote is awaited') };
    });

    useEffect(() => {
        let pulse: ReturnType<typeof setTimeout> | null = null;

        const stop = subscribeRotiNudges(() => {
            if (!latest.current.awaited) {
                return;
            }

            toast(latest.current.message);
            setNudged(true);

            if (pulse) {
                clearTimeout(pulse);
            }

            pulse = setTimeout(() => setNudged(false), NudgePulseMs);
        });

        return () => {
            stop();

            if (pulse) {
                clearTimeout(pulse);
            }
        };
    }, [subscribeRotiNudges]);

    return nudged;
}
