import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { Palette } from './branding';
import { adjustedPalette, samplePalette, weakPalette } from './samples';
import { usePalettePreview } from './use-palette-preview';

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

const request = vi.mocked(retroRequest);

type Deferred = {
    resolve: (palette: Palette) => void;
    reject: (reason: unknown) => void;
};

function deferNextRequest(): Deferred {
    const deferred = {} as Deferred;
    const pending = new Promise<Palette>((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    request.mockImplementationOnce(() => pending as Promise<never>);

    return deferred;
}

function setup(color: string, initialPalette: Palette | null = samplePalette) {
    return renderHook(
        (props: { color: string }) =>
            usePalettePreview({
                color: props.color,
                fallbackColor: '#bb4d2a',
                initialPalette,
            }),
        { initialProps: { color } },
    );
}

async function wait(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

function requestedUrls(): string[] {
    return request.mock.calls.map(([route]) => route.url);
}

beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('usePalettePreview', () => {
    it('does not ask for the palette the page already has', async () => {
        const { result } = setup('#2b63b0');

        await wait(1000);

        expect(request).not.toHaveBeenCalled();
        expect(result.current.palette).toBe(samplePalette);
    });

    it('does not ask for the palette the page already has in strict mode', async () => {
        renderHook(
            () =>
                usePalettePreview({
                    color: '#2b63b0',
                    fallbackColor: '#bb4d2a',
                    initialPalette: samplePalette,
                }),
            { reactStrictMode: true },
        );

        await wait(1000);

        expect(request).not.toHaveBeenCalled();
    });

    it('sends one request for three colours typed quickly', async () => {
        request.mockResolvedValue(adjustedPalette);

        const { result, rerender } = setup('#2b63b0');

        rerender({ color: '#f' });
        await wait(100);
        rerender({ color: '#ffd' });
        await wait(100);
        rerender({ color: '#ffd600' });
        await wait(249);

        expect(request).not.toHaveBeenCalled();

        await wait(1);

        expect(requestedUrls()).toEqual([
            '/admin/branding/preview?color=%23ffd600',
        ]);
        expect(result.current.palette).toBe(adjustedPalette);
        expect(result.current.loading).toBe(false);
    });

    it('keeps the newer palette when an older response arrives late', async () => {
        const first = deferNextRequest();
        const second = deferNextRequest();
        const { result, rerender } = setup('#2b63b0');

        rerender({ color: '#ffd600' });
        await wait(250);
        rerender({ color: '#777777' });
        await wait(250);

        expect(request).toHaveBeenCalledTimes(2);
        expect(result.current.palette).toBe(samplePalette);
        expect(result.current.loading).toBe(true);

        await act(async () => second.resolve(weakPalette));
        await act(async () => first.resolve(adjustedPalette));

        expect(result.current.palette).toBe(weakPalette);
        expect(result.current.loading).toBe(false);
    });

    it('reports an invalid colour without a request and keeps the palette', async () => {
        const { result, rerender } = setup('#2b63b0');

        rerender({ color: 'not a colour' });
        await wait(250);

        expect(request).not.toHaveBeenCalled();
        expect(result.current.error).toEqual({ type: 'invalid' });
        expect(result.current.palette).toBe(samplePalette);
    });

    it('shows the server refusal and keeps the palette', async () => {
        request.mockRejectedValueOnce(
            new RetroRequestError(422, 'The colour must be a hex value.'),
        );

        const { result, rerender } = setup('#2b63b0');

        rerender({ color: '#abc' });
        await wait(250);

        expect(result.current.error).toEqual({
            type: 'server',
            message: 'The colour must be a hex value.',
        });
        expect(result.current.palette).toBe(samplePalette);

        request.mockResolvedValueOnce(adjustedPalette);
        rerender({ color: '#ffd600' });
        await wait(250);

        expect(result.current.error).toBeNull();
        expect(result.current.palette).toBe(adjustedPalette);
    });

    it('asks for the default colour when nothing is stored or typed', async () => {
        request.mockResolvedValue(samplePalette);

        const { result } = setup('', null);

        await wait(250);

        expect(requestedUrls()).toEqual([
            '/admin/branding/preview?color=%23bb4d2a',
        ]);
        expect(result.current.palette).toBe(samplePalette);
    });
});
