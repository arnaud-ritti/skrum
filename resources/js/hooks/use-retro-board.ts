import { useCallback, useReducer, useState } from 'react';
import { toast } from 'sonner';
import RetroSnapshotsController from '@/actions/App/Http/Controllers/Retros/RetroSnapshotsController';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { boardReducer } from '@/lib/retro/board-reducer';
import type {
    ActionItem,
    BoardColumn,
    CardPayload,
    Snapshot,
} from '@/lib/retro/types';
import { useRetroChannel, type RetroEvent } from './use-retro-channel';

export type BoardStatus = 'active' | 'ended' | 'deleted';

export function useRetroBoard(initial: Snapshot) {
    const { t } = useTrans();
    const [board, dispatch] = useReducer(boardReducer, initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const retroId = initial.retro.id;

    const refetch = useCallback(async () => {
        try {
            const snapshot = await retroRequest<Snapshot>(
                RetroSnapshotsController.show(retroId),
            );
            dispatch({ type: 'replace', snapshot });
        } catch (error) {
            if (
                error instanceof RetroRequestError &&
                [403, 404].includes(error.status)
            ) {
                setStatus('ended');
            }
        }
    }, [retroId]);

    const onEvent = useCallback(
        ({ name, payload }: RetroEvent) => {
            switch (name) {
                case 'card.created':
                case 'card.updated':
                    dispatch({
                        type: 'cards.upsert',
                        cards: [payload.card as CardPayload],
                    });
                    break;
                case 'card.deleted':
                    dispatch({
                        type: 'card.remove',
                        cardId: payload.cardId as string,
                        ungroupedCards: payload.ungroupedCards as CardPayload[],
                    });
                    break;
                case 'cards.moved':
                case 'card.grouped':
                case 'card.ungrouped':
                    dispatch({
                        type: 'cards.upsert',
                        cards: payload.cards as CardPayload[],
                    });
                    break;
                case 'vote.cast':
                case 'vote.retracted':
                    dispatch({
                        type: 'votes.cast',
                        votesCast: payload.votesCast as number,
                    });
                    break;
                case 'timer.changed':
                    dispatch({
                        type: 'timer.set',
                        timerEndsAt: payload.timerEndsAt as string | null,
                    });
                    break;
                case 'card.highlighted':
                    dispatch({
                        type: 'highlight.set',
                        cardId: payload.cardId as string | null,
                    });
                    break;
                case 'columns.changed':
                    dispatch({
                        type: 'columns.set',
                        columns: payload.columns as BoardColumn[],
                    });
                    break;
                case 'action-item.saved':
                    dispatch({
                        type: 'actionItem.upsert',
                        actionItem: payload.actionItem as ActionItem,
                    });
                    break;
                case 'action-item.deleted':
                    dispatch({
                        type: 'actionItem.remove',
                        actionItemId: payload.actionItemId as string,
                    });
                    break;
                case 'phase.changed':
                case 'settings.changed':
                    void refetch();
                    break;
                case 'retro.deleted':
                    setStatus('deleted');
                    break;
            }
        },
        [refetch],
    );

    const { online, connected } = useRetroChannel(
        retroId,
        status === 'active',
        onEvent,
        refetch,
    );

    const run = useCallback(
        async <T>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                toast.error(
                    error instanceof RetroRequestError
                        ? error.message
                        : t('Something went wrong. Please try again.'),
                );
                await refetch();

                return undefined;
            }
        },
        [refetch, t],
    );

    return { board, dispatch, refetch, status, online, connected, run };
}
