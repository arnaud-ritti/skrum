import { useCallback } from 'react';
import GameGifsController from '@/actions/App/Http/Controllers/Games/GameGifsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import type { GameGifSearchResult } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    provider: 'giphy' | 'tenor' | null;
};

export function GameGifPicker({ open, onOpenChange, onPick, provider }: Props) {
    const roomId = useRoom().snapshot.room.id;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                GameGifsController.index(roomId, { query: { q: query } }),
            ),
        [roomId],
    );

    return (
        <GifSearchDialog
            open={open}
            onOpenChange={onOpenChange}
            onPick={onPick}
            search={search}
            provider={provider}
        />
    );
}
