import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiPicker, EmojiPickerPanel } from '@/components/retro/emoji-picker';
import { readRecent } from '@/lib/emoji/recent';
import { renderWithProviders } from '@/test/render';

const emojiData = { baseUrl: '/emoji', locale: 'en' };

const emojis = [
    { emoji: '🚀', label: 'rocket', group: 0, order: 1, version: 0.6 },
    { emoji: '🦄', label: 'unicorn', group: 0, order: 2, version: 0.6 },
];

const messages = {
    groups: [{ key: 'objects', message: 'objects', order: 0 }],
    subgroups: [{ key: 'sky', message: 'sky', order: 0 }],
    skinTones: [
        { key: 'light', message: 'light skin tone' },
        { key: 'medium-light', message: 'medium-light skin tone' },
        { key: 'medium', message: 'medium skin tone' },
        { key: 'medium-dark', message: 'medium-dark skin tone' },
        { key: 'dark', message: 'dark skin tone' },
    ],
};

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
            Response.json(url.endsWith('messages.json') ? messages : emojis),
        ),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
});

function quickRow(onPick = vi.fn(), data: typeof emojiData | null = emojiData) {
    renderWithProviders(
        <EmojiPicker
            label="Add a reaction"
            onPick={onPick}
            emojiData={data ?? undefined}
        >
            <button type="button">React</button>
        </EmojiPicker>,
    );

    const trigger = screen.getByRole('button', { name: 'Add a reaction' });

    fireEvent.click(trigger);

    return trigger;
}

describe('EmojiPicker', () => {
    it('has no search field in the quick row', () => {
        quickRow();

        const row = screen.getByRole('group', { name: 'Add a reaction' });

        expect(within(row).getAllByRole('button')).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: 'More emoji…' }),
        ).toBeTruthy();
        expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('opens the picker from More emoji and returns to the quick row with Esc', async () => {
        const trigger = quickRow();

        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));

        const search = screen.getByRole('searchbox', {
            name: 'Search an emoji…',
        });

        expect(document.activeElement).toBe(search);
        expect(
            screen.queryByRole('group', { name: 'Add a reaction' }),
        ).toBeNull();

        fireEvent.keyDown(search, { key: 'Escape' });

        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(
            screen.getByRole('group', { name: 'Add a reaction' }),
        ).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'More emoji…' }),
        );

        fireEvent.keyDown(document.activeElement as HTMLElement, {
            key: 'Escape',
        });

        await waitFor(() =>
            expect(
                screen.queryByRole('group', { name: 'Add a reaction' }),
            ).toBeNull(),
        );
        expect(document.activeElement).toBe(trigger);
    });

    it('picks a quick reaction, closes and remembers it', async () => {
        const onPick = vi.fn();

        quickRow(onPick);
        fireEvent.click(screen.getByRole('button', { name: '🎉' }));

        expect(onPick).toHaveBeenCalledWith('🎉');
        expect(readRecent()).toEqual(['🎉']);
        await waitFor(() =>
            expect(
                screen.queryByRole('group', { name: 'Add a reaction' }),
            ).toBeNull(),
        );
    });

    it('offers no More emoji without an emoji list', () => {
        quickRow(vi.fn(), null);

        expect(
            screen.getByRole('group', { name: 'Add a reaction' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'More emoji…' }),
        ).toBeNull();
    });
});

describe('EmojiPickerPanel', () => {
    function panel(onPick = vi.fn()) {
        return renderWithProviders(
            <EmojiPickerPanel emojiData={emojiData} onPick={onPick} />,
        );
    }

    it('focuses the search field on opening', () => {
        panel();

        expect(document.activeElement).toBe(
            screen.getByRole('searchbox', { name: 'Search an emoji…' }),
        );
    });

    it('shows Recent after a pick and hides it while searching', async () => {
        const onPick = vi.fn();
        const first = panel(onPick);

        expect(screen.queryByRole('group', { name: 'Recent' })).toBeNull();

        fireEvent.click(
            await screen.findByRole('gridcell', { name: 'Rocket' }),
        );

        expect(onPick).toHaveBeenCalledWith('🚀');

        first.unmount();
        panel(onPick);

        const recent = screen.getByRole('group', { name: 'Recent' });

        fireEvent.click(within(recent).getByRole('button', { name: '🚀' }));

        expect(onPick).toHaveBeenCalledTimes(2);
        expect(onPick).toHaveBeenLastCalledWith('🚀');

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'uni' },
        });

        expect(screen.queryByRole('group', { name: 'Recent' })).toBeNull();
    });

    it('names the active emoji in the footer', async () => {
        const { container } = panel();
        const footer = container.querySelector(
            '[data-slot="emoji-picker-footer"]',
        ) as HTMLElement;

        await screen.findByRole('gridcell', { name: 'Rocket' });

        expect(within(footer).getByText('Pick an emoji')).toBeTruthy();

        fireEvent.keyDown(document, { key: 'ArrowDown' });

        expect(await within(footer).findByText('Rocket')).toBeTruthy();
        expect(within(footer).getByText('🚀')).toBeTruthy();
        expect(within(footer).queryByText('Pick an emoji')).toBeNull();
    });

    it('says when nothing matches', async () => {
        panel();

        await screen.findByRole('gridcell', { name: 'Rocket' });

        fireEvent.change(screen.getByRole('searchbox'), {
            target: { value: 'zzz' },
        });

        expect(await screen.findByText('No emoji matches')).toBeTruthy();
    });
});
