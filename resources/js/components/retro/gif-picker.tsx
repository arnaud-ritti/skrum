import { useEffect, useState } from 'react';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';

export type PickedGif = { id: string; previewUrl: string };

type Result = PickedGif & { width: number; height: number };

const SearchDelayMs = 300;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
};

export function GifPicker({ open, onOpenChange, onPick }: Props) {
    const { board } = useBoard();
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<Result[]>([]);
    const [error, setError] = useState<'rate' | 'unavailable' | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        let stale = false;

        setError(null);

        const timer = setTimeout(() => {
            retroRequest<{ gifs: Result[] }>(
                RetroGifsController.index(board.retro.id, {
                    query: { q: query },
                }),
            )
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
    }, [open, query, board.retro.id]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                {...dragIsolation}
                aria-describedby={undefined}
                className="max-w-lg"
            >
                <DialogTitle>{t('Choose a GIF')}</DialogTitle>
                <div {...dragIsolation}>
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
                        provider:
                            board.retro.gifProvider === 'tenor'
                                ? 'Tenor'
                                : 'GIPHY',
                    })}
                </p>
            </DialogContent>
        </Dialog>
    );
}
