import { useEffect, useRef, useState } from 'react';
import { RetroRequestError } from '@/lib/retro/api';
import { normalizeHex, PreviewDelayMs } from './branding';
import type { Palette } from './branding';
import { fetchPalettePreview } from './branding-api';

export type PreviewError =
    | { type: 'invalid' }
    | { type: 'unavailable' }
    | { type: 'server'; message: string };

function previewError(error: unknown): PreviewError {
    if (error instanceof RetroRequestError && error.status === 422) {
        return { type: 'server', message: error.message };
    }

    return { type: 'unavailable' };
}

/**
 * Palette derived by the server for the typed colour. Requests wait for a
 * pause in typing, a response to an older colour is dropped, and the last good
 * palette stays while a request runs or after a refusal.
 */
export function usePalettePreview({
    color,
    fallbackColor,
    initialPalette,
    delayMs = PreviewDelayMs,
}: {
    color: string;
    fallbackColor: string;
    initialPalette: Palette | null;
    delayMs?: number;
}): { palette: Palette | null; loading: boolean; error: PreviewError | null } {
    const [palette, setPalette] = useState(initialPalette);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<PreviewError | null>(null);
    const latestRequest = useRef(0);
    const colorOfInitialPalette = useRef(
        initialPalette === null ? null : color,
    );

    useEffect(() => {
        if (color === colorOfInitialPalette.current) {
            return;
        }

        colorOfInitialPalette.current = null;

        const typed = color.trim();
        const timer = setTimeout(() => {
            const hex = normalizeHex(typed === '' ? fallbackColor : typed);

            if (hex === null) {
                setLoading(false);
                setError({ type: 'invalid' });

                return;
            }

            const request = ++latestRequest.current;

            setLoading(true);

            fetchPalettePreview(hex)
                .then((next) => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setPalette(next);
                    setError(null);
                    setLoading(false);
                })
                .catch((reason: unknown) => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setError(previewError(reason));
                    setLoading(false);
                });
        }, delayMs);

        return () => {
            clearTimeout(timer);
            latestRequest.current++;
        };
    }, [color, fallbackColor, delayMs]);

    return { palette, loading, error };
}
