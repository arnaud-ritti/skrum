import type { HTMLAttributes, ReactElement } from 'react';
import { GifPicker } from '@/components/skrum/gif-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifSearchResult } from '@/lib/games/types';
import { useGifSearch } from './use-gif-search';

export type PickedGif = { id: string; previewUrl: string };

type Isolation = Pick<
    HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'onPointerDown'
>;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>;
    provider: 'giphy' | 'tenor' | null;
    selectedId?: string;
    /** Keeps key and pointer events away from surrounding drag-and-drop. */
    isolation?: Isolation;
};

export function GifSearchDialog({
    open,
    onOpenChange,
    onPick,
    search,
    provider,
    selectedId,
    isolation,
}: Props): ReactElement {
    const { t } = useTrans();
    const { results, status, setQuery, retry } = useGifSearch(
        search,
        open && provider !== null,
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...isolation}
                aria-describedby={undefined}
                showCloseButton={false}
                className="gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-104"
            >
                <DialogTitle className="sr-only">
                    {t('Choose a GIF')}
                </DialogTitle>
                <GifPicker
                    open={open}
                    onOpenChange={onOpenChange}
                    role="group"
                    results={results}
                    provider={provider ?? undefined}
                    status={provider === null ? 'disabled' : status}
                    selectedId={selectedId}
                    onSelect={(gif) => {
                        onPick({ id: gif.id, previewUrl: gif.previewUrl });
                        onOpenChange(false);
                    }}
                    onQueryChange={setQuery}
                    onRetry={retry}
                />
            </DialogContent>
        </Dialog>
    );
}
