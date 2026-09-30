import { useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { GameGifSearchResult } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';

export type PickedGif = { id: string; previewUrl: string };

type Isolation = Pick<
    HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'onPointerDown'
>;

const SearchDelayMs = 300;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>;
    provider: 'giphy' | 'tenor' | null;
    /** Keeps key and pointer events away from surrounding drag-and-drop. */
    isolation?: Isolation;
};

export function GifSearchDialog({
    open,
    onOpenChange,
    onPick,
    search,
    provider,
    isolation,
}: Props) {
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<GameGifSearchResult[]>([]);
    const [error, setError] = useState<'rate' | 'unavailable' | null>(null);
    const [loaded, setLoaded] = useState(false);
    const latestSearch = useRef(search);

    useEffect(() => {
        latestSearch.current = search;
    }, [search]);

    useEffect(() => {
        if (!open) {
            return;
        }

        let stale = false;

        setError(null);

        const timer = setTimeout(() => {
            latestSearch
                .current(query)
                .then((response) => {
                    if (stale) {
                        return;
                    }

                    setGifs(response.gifs);
                    setLoaded(true);
                })
                .catch((caught: unknown) => {
                    if (stale) {
                        return;
                    }

                    const tooMany =
                        caught instanceof RetroRequestError &&
                        caught.status === 429;

                    setError(tooMany ? 'rate' : 'unavailable');
                });
        }, SearchDelayMs);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [open, query]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...isolation}
                aria-describedby={undefined}
                className="max-w-lg"
            >
                <DialogTitle>{t('Choose a GIF')}</DialogTitle>
                <div {...isolation}>
                    <Input
                        value={query}
                        placeholder={t('Search GIFs…')}
                        aria-label={t('Search GIFs…')}
                        autoFocus
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error === 'rate'
                            ? t('Too many searches, wait a moment.')
                            : t('GIF search is unavailable.')}
                    </p>
                )}
                <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
                    {gifs.map((gif) => (
                        <button
                            key={gif.id}
                            type="button"
                            aria-label={t('Choose this GIF')}
                            className="overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => {
                                onPick({
                                    id: gif.id,
                                    previewUrl: gif.previewUrl,
                                });
                                onOpenChange(false);
                            }}
                        >
                            <img
                                src={gif.previewUrl}
                                alt=""
                                width={gif.width}
                                height={gif.height}
                                loading="lazy"
                                className="h-auto w-full"
                            />
                        </button>
                    ))}
                </div>
                {!error && loaded && gifs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        {t('No GIFs found.')}
                    </p>
                )}
                <p className="text-right text-xs text-muted-foreground">
                    {t('Powered by :provider', {
                        provider: provider === 'tenor' ? 'Tenor' : 'GIPHY',
                    })}
                </p>
            </DialogContent>
        </Dialog>
    );
}
