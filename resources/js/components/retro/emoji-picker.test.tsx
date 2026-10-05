import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { renderWithProviders } from '@/test/render';

describe('EmojiPicker', () => {
    it('gives the focus back to its button once the emoji search opened from its menu closes', async () => {
        renderWithProviders(
            <EmojiPicker
                label="Add a reaction"
                onPick={vi.fn()}
                emojiData={{ baseUrl: '/emoji', locale: 'en' }}
            >
                <button type="button">React</button>
            </EmojiPicker>,
        );

        const trigger = screen.getByRole('button', { name: 'Add a reaction' });

        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
        fireEvent.click(
            await screen.findByRole('menuitem', { name: 'More emoji…' }),
        );

        const dialog = await screen.findByRole('dialog', {
            name: 'Add a reaction',
        });

        fireEvent.keyDown(dialog, { key: 'Escape' });

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(document.activeElement).toBe(trigger);
    });
});
