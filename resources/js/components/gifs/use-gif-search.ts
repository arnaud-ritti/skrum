import { useEffect, useEffectEvent, useState } from 'react';
import type { GifItem, GifPickerStatus } from '@/components/skrum/gif-picker';
import type { GameGifSearchResult } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';

const SearchDelayMs = 300;

type Search = (query: string) => Promise<{ gifs: GameGifSearchResult[] }>;

type Answer = {
    request: string;
    results: GifItem[];
    status: GifPickerStatus;
};

export function gifStatusOf(
    error: unknown,
): 'rate_limited' | 'disabled' | 'error' {
    if (!(error instanceof RetroRequestError)) {
        return 'error';
    }

    if (error.status === 429) {
        return 'rate_limited';
    }

    if (error.status === 403 || error.status === 404) {
        return 'disabled';
    }

    return 'error';
}

/**
 * Searches 300 ms after the last keystroke, with the empty query when the
 * picker opens. An answer that is no longer the latest request is dropped.
 */
export function useGifSearch(
    search: Search,
    open: boolean,
): {
    results: GifItem[];
    status: GifPickerStatus;
    setQuery: (query: string) => void;
    retry: () => void;
} {
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [wasOpen, setWasOpen] = useState(open);
    const runSearch = useEffectEvent((term: string) => search(term));
    const request = `${attempt}:${query}`;

    if (wasOpen !== open) {
        setWasOpen(open);
        setQuery('');
        setAnswer(null);
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        let stale = false;

        const timer = setTimeout(() => {
            runSearch(query)
                .then((response) => {
                    if (stale) {
                        return;
                    }

                    setAnswer({
                        request,
                        results: response.gifs,
                        status: response.gifs.length === 0 ? 'empty' : 'idle',
                    });
                })
                .catch((caught: unknown) => {
                    if (stale) {
                        return;
                    }

                    setAnswer({
                        request,
                        results: [],
                        status: gifStatusOf(caught),
                    });
                });
        }, SearchDelayMs);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [open, query, request]);

    const settled = answer?.request === request ? answer : null;

    return {
        results: settled?.results ?? [],
        status: settled?.status ?? 'loading',
        setQuery,
        retry: () => setAttempt((current) => current + 1),
    };
}
