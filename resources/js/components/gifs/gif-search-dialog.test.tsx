import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GifSearchDialog } from '@/components/gifs/gif-search-dialog';
import type { GameGifSearchResult } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';

function gif(id: string): GameGifSearchResult {
    return { id, previewUrl: `/gifs/${id}/preview`, width: 200, height: 100 };
}

describe('GifSearchDialog', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('asks for nothing and says GIFs are disabled without a provider', async () => {
        const search = vi.fn().mockResolvedValue({ gifs: [gif('a')] });

        renderWithProviders(
            <GifSearchDialog
                open
                onOpenChange={vi.fn()}
                onPick={vi.fn()}
                search={search}
                provider={null}
            />,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(search).not.toHaveBeenCalled();
        expect(screen.getByText('GIFs are disabled')).toBeTruthy();
    });

    it('hands the picked GIF over and closes', async () => {
        const search = vi.fn().mockResolvedValue({ gifs: [gif('a')] });
        const onPick = vi.fn();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <GifSearchDialog
                open
                onOpenChange={onOpenChange}
                onPick={onPick}
                search={search}
                provider="giphy"
            />,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        fireEvent.click(screen.getByRole('option'));

        expect(onPick).toHaveBeenCalledWith({
            id: 'a',
            previewUrl: '/gifs/a/preview',
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('has a named control to close the dialog', () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <GifSearchDialog
                open
                onOpenChange={onOpenChange}
                onPick={vi.fn()}
                search={vi.fn().mockResolvedValue({ gifs: [] })}
                provider="giphy"
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
