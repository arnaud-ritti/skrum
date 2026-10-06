import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionReactionPicker } from '@/components/session/session-reaction-picker';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import { renderWithProviders } from '@/test/render';

const emojiData = { baseUrl: '/emoji', locale: 'en' };

function bar() {
    renderWithProviders(
        <ReactionBar
            onReact={vi.fn()}
            picker={
                <SessionReactionPicker onPick={vi.fn()} emojiData={emojiData} />
            }
        />,
    );

    return screen.getByRole('button', { name: 'More emoji…' });
}

describe('SessionReactionPicker', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("opens the picker directly from the bar's last button", async () => {
        const last = bar();
        const buttons = screen
            .getByRole('toolbar', { name: 'Reactions' })
            .querySelectorAll('button');

        expect(buttons[buttons.length - 1]).toBe(last);

        fireEvent.click(last);

        const search = screen.getByRole('searchbox', {
            name: 'Search an emoji…',
        });

        expect(document.activeElement).toBe(search);

        fireEvent.keyDown(search, { key: 'Escape' });

        await waitFor(() => expect(screen.queryByRole('searchbox')).toBeNull());
        expect(document.activeElement).toBe(last);
    });

    it('does not repeat the quick reactions', () => {
        fireEvent.click(bar());

        expect(screen.getByRole('searchbox')).toBeTruthy();
        expect(
            document.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(6);
        expect(screen.queryByRole('button', { name: '👍' })).toBeNull();
    });
});
