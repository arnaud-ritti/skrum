import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    GifPicker,
    formatGifDuration,
    splitIntoColumns,
} from '@/components/skrum/gif-picker';
import type { GifItem, GifPickerProps } from '@/components/skrum/gif-picker';
import { renderWithProviders } from '@/test/render';

function gif(
    id: string,
    height = 100,
    overrides: Partial<GifItem> = {},
): GifItem {
    return {
        id,
        title: `Gif ${id}`,
        durationMs: 2400,
        width: 200,
        height,
        mp4: `/gifs/${id}.mp4`,
        webp: `/gifs/${id}.webp`,
        still: `/gifs/${id}.png`,
        ...overrides,
    };
}

const results = [gif('a', 300), gif('b', 100), gif('c', 100), gif('d', 100)];

function setup(props: Partial<GifPickerProps> = {}) {
    const handlers = {
        onOpenChange: vi.fn(),
        onSelect: vi.fn(),
        onQueryChange: vi.fn(),
    };
    const view = renderWithProviders(
        <GifPicker
            open
            lang="en"
            reducedMotion={false}
            results={results}
            {...handlers}
            {...props}
        />,
    );

    return { ...handlers, ...view };
}

describe('GifPicker helpers', () => {
    it('formats the duration in the given language', () => {
        expect(formatGifDuration(2400, 'en')).toBe('2.4 s');
        expect(formatGifDuration(2400, 'fr')).toBe('2,4 s');
    });

    it('puts each tile in the shortest column', () => {
        const [left, right] = splitIntoColumns(results);

        expect(left.map((item) => item.id)).toEqual(['a']);
        expect(right.map((item) => item.id)).toEqual(['b', 'c', 'd']);
    });
});

describe('GifPicker', () => {
    it('renders nothing when closed', () => {
        setup({ open: false });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens as a labelled dialog with focus in the search and trending active', () => {
        setup();

        expect(
            screen.getByRole('dialog', { name: 'Choose a GIF' }),
        ).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByRole('searchbox', { name: 'Search GIPHY' }),
        );
        expect(
            screen
                .getByRole('tab', { name: 'Trending' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.getByText('Trending now')).toBeTruthy();
        expect(screen.getByText('4 trending GIFs')).toBeTruthy();
    });

    it('names each tile with its title and duration and reserves its ratio', () => {
        setup();

        const tile = screen.getByRole('option', { name: 'Gif a · 2.4 s' });

        expect(tile.style.aspectRatio).toBe('200 / 300');
        expect(tile.querySelector('video')?.getAttribute('aria-label')).toBe(
            'Gif a · 2.4 s',
        );
    });

    it('shows the attribution of the active provider', () => {
        const { unmount } = setup();
        expect(screen.getByText('Powered by GIPHY')).toBeTruthy();
        expect(screen.getByText('Rated G')).toBeTruthy();
        unmount();

        setup({ provider: 'tenor', rating: 'pg' });
        expect(screen.getByText('Powered by Tenor')).toBeTruthy();
        expect(
            screen.getByRole('searchbox', { name: 'Search Tenor' }),
        ).toBeTruthy();
        expect(screen.getByText('Rated PG')).toBeTruthy();
    });

    it('reports typing, clears the search and announces the results', () => {
        const { onQueryChange } = setup({ initialQuery: 'tired' });
        const search = screen.getByRole('searchbox') as HTMLInputElement;

        expect(
            screen.getAllByText('Results for “tired”').length,
        ).toBeGreaterThan(0);
        expect(screen.getByText('4 GIFs for “tired”')).toBeTruthy();
        expect(
            screen
                .getByRole('tab', { name: 'Tired' })
                .getAttribute('aria-selected'),
        ).toBe('true');

        fireEvent.change(search, { target: { value: 'cats' } });
        expect(onQueryChange).toHaveBeenLastCalledWith('cats');

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(onQueryChange).toHaveBeenLastCalledWith('');
        expect(search.value).toBe('');
        expect(document.activeElement).toBe(search);
        expect(
            screen.queryByRole('button', { name: 'Clear search' }),
        ).toBeNull();
    });

    it('moves between categories with the arrow keys', () => {
        const { onQueryChange } = setup();
        const trending = screen.getByRole('tab', { name: 'Trending' });

        fireEvent.keyDown(trending, { key: 'ArrowRight' });
        const celebrate = screen.getByRole('tab', { name: 'Celebrate' });
        expect(document.activeElement).toBe(celebrate);
        expect(celebrate.getAttribute('aria-selected')).toBe('true');
        expect(onQueryChange).toHaveBeenLastCalledWith('celebrate');

        fireEvent.keyDown(celebrate, { key: 'ArrowLeft' });
        fireEvent.keyDown(trending, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(
            screen.getByRole('tab', { name: 'Deadline' }),
        );
    });

    it('selects a GIF by click and by Enter', () => {
        const { onSelect } = setup();

        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));
        expect(onSelect).toHaveBeenLastCalledWith(results[1]);

        fireEvent.keyDown(screen.getByRole('option', { name: /Gif c/ }), {
            key: 'Enter',
        });
        expect(onSelect).toHaveBeenLastCalledWith(results[2]);
    });

    it('navigates the grid with the arrow keys, Home and End', () => {
        setup();
        const tile = (name: string) =>
            screen.getByRole('option', { name: new RegExp(`Gif ${name}`) });

        tile('b').focus();
        fireEvent.keyDown(tile('b'), { key: 'ArrowDown' });
        expect(document.activeElement).toBe(tile('c'));
        fireEvent.keyDown(tile('c'), { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(tile('a'));
        fireEvent.keyDown(tile('a'), { key: 'ArrowRight' });
        expect(document.activeElement).toBe(tile('b'));
        fireEvent.keyDown(tile('b'), { key: 'End' });
        expect(document.activeElement).toBe(tile('d'));
        fireEvent.keyDown(tile('d'), { key: 'Home' });
        expect(document.activeElement).toBe(tile('a'));
        expect(tile('a').tabIndex).toBe(0);
        expect(tile('b').tabIndex).toBe(-1);
    });

    it('marks the selected tile', () => {
        setup({ selectedId: 'c' });

        const selected = screen.getByRole('option', { name: /Gif c/ });

        expect(selected.getAttribute('aria-selected')).toBe('true');
        expect(selected.querySelector('[data-slot="gif-tick"]')).toBeTruthy();
        expect(selected.tabIndex).toBe(0);
        expect(
            screen
                .getByRole('option', { name: /Gif a/ })
                .getAttribute('aria-selected'),
        ).toBe('false');
    });

    it('pauses and resumes a tile with Space', () => {
        const { onSelect } = setup();
        const tile = screen.getByRole('option', { name: /Gif a/ });

        fireEvent.keyDown(tile, { key: ' ' });
        expect(tile.querySelector('video')).toBeNull();
        expect(tile.querySelector('img')?.getAttribute('src')).toBe(
            '/gifs/a.png',
        );

        fireEvent.keyDown(tile, { key: ' ' });
        expect(tile.querySelector('video')).toBeTruthy();
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('shows stills with reduced motion and plays only on hover, focus or Space', () => {
        setup({ reducedMotion: true });
        const tile = screen.getByRole('option', { name: /Gif a/ });

        expect(document.querySelector('video')).toBeNull();
        expect(tile.querySelector('img')?.getAttribute('alt')).toBe(
            'Gif a · 2.4 s',
        );
        expect(tile.querySelector('[data-slot="gif-play"]')).toBeTruthy();
        expect(
            screen.getByText('Reduced motion: hover or press to play'),
        ).toBeTruthy();

        fireEvent.mouseEnter(tile);
        expect(tile.querySelector('video')).toBeTruthy();
        fireEvent.mouseLeave(tile);
        expect(tile.querySelector('video')).toBeNull();

        fireEvent.keyDown(tile, { key: ' ' });
        expect(tile.querySelector('video')).toBeTruthy();
        expect(document.querySelectorAll('video').length).toBe(1);
    });

    it('previews before sending and sends the trimmed caption', () => {
        const { onSelect } = setup({ withCaption: true });

        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('Gif b')).toBeTruthy();
        expect(screen.getByText(/looping/)).toBeTruthy();
        expect(screen.getByText('Powered by GIPHY')).toBeTruthy();

        fireEvent.change(screen.getByRole('textbox', { name: 'Caption' }), {
            target: { value: '  my sprint  ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send this GIF' }));

        expect(onSelect).toHaveBeenCalledWith(results[1], 'my sprint');
    });

    it('sends without caption when it is left empty and goes back to the grid', () => {
        const { onSelect } = setup({ withCaption: true });

        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByRole('listbox')).toBeTruthy();

        fireEvent.click(screen.getByRole('option', { name: /Gif a/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Send this GIF' }));
        expect(onSelect).toHaveBeenCalledWith(results[0], undefined);
    });

    it('caps the caption at the limit and counts the characters', () => {
        setup({ withCaption: true, captionMaxLength: 10 });

        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));
        const caption = screen.getByRole('textbox', {
            name: 'Caption',
        }) as HTMLInputElement;

        expect(caption.maxLength).toBe(10);
        expect(screen.getByText('0/10')).toBeTruthy();

        fireEvent.change(caption, { target: { value: 'abcdefghijklmnop' } });
        expect(caption.value).toBe('abcdefghij');
        expect(screen.getByText('10/10')).toBeTruthy();
    });

    it('uses 60 characters as the default caption limit', () => {
        setup({ withCaption: true });

        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));

        expect(screen.getByText('0/60')).toBeTruthy();
    });

    it('drops the preview when it is closed and reopened', () => {
        const { rerender, onOpenChange, onSelect } = setup({
            withCaption: true,
        });
        fireEvent.click(screen.getByRole('option', { name: /Gif b/ }));

        const picker = (open: boolean) => (
            <GifPicker
                open={open}
                lang="en"
                reducedMotion={false}
                withCaption
                results={results}
                onOpenChange={onOpenChange}
                onSelect={onSelect}
            />
        );
        rerender(picker(false));
        rerender(picker(true));

        expect(screen.getByRole('listbox')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Send this GIF' }),
        ).toBeNull();
    });

    it('keeps the typed query when new results arrive', () => {
        const { rerender, onOpenChange, onSelect } = setup();
        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'cats' },
        });

        rerender(
            <GifPicker
                open
                lang="en"
                reducedMotion={false}
                results={[gif('z')]}
                onOpenChange={onOpenChange}
                onSelect={onSelect}
            />,
        );

        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(
            'cats',
        );
        expect(screen.getAllByRole('option').length).toBe(1);
    });

    it('closes on Escape', () => {
        const { onOpenChange } = setup();

        fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows six skeletons and a busy body while loading', () => {
        setup({ status: 'loading' });

        expect(
            document
                .querySelector('[data-slot="gif-picker-body"]')
                ?.getAttribute('aria-busy'),
        ).toBe('true');
        expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(
            6,
        );
        expect(screen.getByText('Loading GIFs…')).toBeTruthy();
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('offers three suggestions when the search is empty-handed', () => {
        const { onQueryChange } = setup({
            status: 'empty',
            initialQuery: 'zzkrum',
            results: [],
            suggestions: ['one', 'two', 'three', 'four'],
        });

        expect(screen.getByText('No GIF for “zzkrum”')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'four' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'two' }));
        expect(onQueryChange).toHaveBeenLastCalledWith('two');
        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(
            'two',
        );
    });

    it('raises an alert with a retry on error', () => {
        const onRetry = vi.fn();
        setup({ status: 'error', onRetry });

        expect(screen.getByRole('alert').textContent).toContain(
            'GIPHY isn’t responding',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('hides retry when no handler is given', () => {
        setup({ status: 'error' });

        expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    it('turns search and categories off when disabled by the admin', () => {
        const onNotifyAdmin = vi.fn();
        setup({ status: 'disabled', onNotifyAdmin });

        expect(
            (screen.getByRole('searchbox') as HTMLInputElement).disabled,
        ).toBe(true);
        screen
            .getAllByRole('tab')
            .forEach((tab) =>
                expect((tab as HTMLButtonElement).disabled).toBe(true),
            );
        expect(screen.getByText('GIFs are disabled')).toBeTruthy();
        expect(screen.getByText('GIPHY integration disabled')).toBeTruthy();
        expect(screen.queryByText('Powered by GIPHY')).toBeNull();
        expect(screen.queryByRole('listbox')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Notify an admin' }),
        );
        expect(onNotifyAdmin).toHaveBeenCalledTimes(1);
    });

    it('asks for more when the grid is scrolled to the end', () => {
        const onLoadMore = vi.fn();
        setup({ onLoadMore });
        const body = document.querySelector(
            '[data-slot="gif-picker-body"]',
        ) as HTMLElement;
        Object.defineProperty(body, 'scrollHeight', { value: 1000 });
        Object.defineProperty(body, 'clientHeight', { value: 256 });

        body.scrollTop = 100;
        fireEvent.scroll(body);
        expect(onLoadMore).not.toHaveBeenCalled();

        body.scrollTop = 720;
        fireEvent.scroll(body);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('renders an empty grid for zero results and copes with 200', () => {
        const { unmount } = setup({ results: [] });
        expect(screen.queryAllByRole('option').length).toBe(0);
        unmount();

        setup({
            results: Array.from({ length: 200 }, (_, index) =>
                gif(`n${index}`),
            ),
        });
        expect(screen.getAllByRole('option').length).toBe(200);
        expect(screen.getByText('200 trending GIFs')).toBeTruthy();
    });

    it('falls back to a neutral placeholder when a GIF has no media', () => {
        setup({ results: [gif('x', 100, { mp4: '', webp: '', still: '' })] });

        const tile = screen.getByRole('option', { name: /Gif x/ });

        expect(
            tile.querySelector('[data-slot="gif-placeholder"]'),
        ).toBeTruthy();
    });
});
