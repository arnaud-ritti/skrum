import { useCallback, useReducer, useRef, useState } from 'react';
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
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const retroId = initial.retro.id;

    const end = useCallback((reason: Exclude<BoardStatus, 'active'>) => {
        if (!isActive.current) {
            return;
        }

        isActive.current = false;
        setStatus(reason);
    }, []);

    const refetch = useCallback(async () => {
        if (!isActive.current) {
            return;
        }

        const request = ++latestRefetch.current;

        try {
            const snapshot = await retroRequest<Snapshot>(
                RetroSnapshotsController.show(retroId),
            );

            if (request !== latestRefetch.current || !isActive.current) {
                return;
            }

            dispatch({ type: 'replace', snapshot });
        } catch (error) {
            if (!(error instanceof RetroRequestError)) {
                return;
            }

            if (error.status === 404) {
                end('deleted');
            }

            if (error.status === 403) {
                end('ended');
            }
        }
    }, [retroId, end]);

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
                    end('deleted');
                    break;
            }
        },
        [refetch, end],
    );

    const { online, connected, reconnecting } = useRetroChannel(
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

    return {
        board,
        dispatch,
        refetch,
        status,
        online,
        connected,
        reconnecting,
        run,
    };
}
