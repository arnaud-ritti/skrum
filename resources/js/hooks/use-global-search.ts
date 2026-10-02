import { useEffect, useRef, useState } from 'react';
import SearchResultsController from '@/actions/App/Http/Controllers/SearchResultsController';
import { retroRequest } from '@/lib/retro/api';

export type SearchResultKind =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'game'
    | 'action'
    | 'card';

export type SearchResult = {
    kind: SearchResultKind;
    id: string;
    title: string;
    team: { id: string; name: string };
    url: string;
    /** Title of the retro a card belongs to. */
    context?: string | null;
};

export const SearchDelayMs = 150;
export const SearchMinLength = 2;

type Found = { results: SearchResult[]; term: string };

const Nothing: Found = { results: [], term: '' };

/**
 * Content search of the palette. Requests wait for a pause in typing and an
 * answer to an older term is dropped.
 */
export function useGlobalSearch(
    query: string,
    delayMs: number = SearchDelayMs,
): Found & { loading: boolean; failed: boolean } {
    const [found, setFound] = useState<Found>(Nothing);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const latestRequest = useRef(0);
    const term = query.trim();

    useEffect(() => {
        if (term.length < SearchMinLength) {
            const reset = setTimeout(() => {
                setFound(Nothing);
                setLoading(false);
                setFailed(false);
            }, 0);

            return () => {
                clearTimeout(reset);
                latestRequest.current++;
            };
        }

        const timer = setTimeout(() => {
            const request = ++latestRequest.current;

            setLoading(true);

            retroRequest<{ results: SearchResult[] }>(
                SearchResultsController.index({ query: { q: term } }),
            )
                .then((response) => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setFound({ results: response.results, term });
                    setFailed(false);
                    setLoading(false);
                })
                .catch(() => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setFound({ results: [], term });
                    setFailed(true);
                    setLoading(false);
                });
        }, delayMs);

        return () => {
            clearTimeout(timer);
            latestRequest.current++;
        };
    }, [term, delayMs]);

    return { ...found, loading, failed };
}
