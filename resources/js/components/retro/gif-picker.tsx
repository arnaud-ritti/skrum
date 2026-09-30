import { useCallback } from 'react';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import {
    GifSearchDialog,
    type PickedGif,
} from '@/components/gifs/gif-search-dialog';
import type { GameGifSearchResult } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

export type { PickedGif };

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
};

export function GifPicker({ open, onOpenChange, onPick }: Props) {
    const { board } = useBoard();
    const retroId = board.retro.id;

    const search = useCallback(
        (query: string) =>
            retroRequest<{ gifs: GameGifSearchResult[] }>(
                RetroGifsController.index(retroId, { query: { q: query } }),
            ),
        [retroId],
    );

    return (
        <GifSearchDialog
            open={open}
            onOpenChange={onOpenChange}
            onPick={onPick}
            search={search}
            provider={board.retro.gifProvider}
            isolation={dragIsolation}
        />
    );
}
