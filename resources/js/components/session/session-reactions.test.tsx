import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionReactions } from '@/components/session/session-reactions';
import { renderWithProviders } from '@/test/render';

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function channel() {
    const listeners = new Map<string, Listener>();

    return {
        whisper: vi.fn(),
        listen: vi.fn((event: string, callback: Listener) =>
            listeners.set(event, callback),
        ),
        stopListening: vi.fn(),
        receive: (senderId: string, data: unknown) =>
            listeners.get('.client-reaction')?.(data, { user_id: senderId }),
    };
}

const online = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: false },
];

const emojiData = { baseUrl: '/emoji', locale: 'en' };

function renderBar(
    presence = channel(),
    toolbarProps = {},
    extra: { emojiData?: typeof emojiData; compact?: boolean } = {},
) {
    renderWithProviders(
        <SessionReactions
            {...extra}
            presence={presence}
            selfId="me"
            online={online}
            labelFor={(id) =>
                online.find((member) => member.id === id)?.name ?? null
            }
            originFor={() => 0.5}
            toolbarProps={toolbarProps}
        />,
    );

    return presence;
}

describe('SessionReactions', () => {
    it('renders the Reactions toolbar with the six quick emoji and the picker trigger', () => {
        renderBar();

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(
            toolbar.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: 'Send a reaction' }),
        ).toBeTruthy();
    });

    it('puts the toolbar props on the toolbar element', () => {
        renderBar(channel(), { className: 'whiteboard-reactions' });

        expect(
            screen
                .getByRole('toolbar', { name: 'Reactions' })
                .classList.contains('whiteboard-reactions'),
        ).toBe(true);
    });

    it('whispers the emoji that is pressed', () => {
        const presence = renderBar();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction 🎉' }),
        );

        expect(presence.whisper).toHaveBeenCalledWith(
            'reaction',
            expect.objectContaining({ e: '🎉' }),
        );
    });

    it('flies a reaction of someone in the room in the library overlay, with the name', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('bob', { v: 1, t: 'r', e: '👏' });
        });

        const overlay = document.querySelector('.lr-overlay');

        expect(overlay?.textContent).toContain('👏');
        expect(overlay?.textContent).toContain('Bob Stone');
        expect(document.querySelector('[data-slot="reaction-fly"]')).toBeNull();
    });

    it('drops a reaction from someone who is not in the room, and a text that is not one emoji', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('stranger', { v: 1, t: 'r', e: '👏' });
            presence.receive('bob', { v: 1, t: 'r', e: 'hello' });
        });

        expect(
            document.querySelector('.lr-overlay')?.textContent ?? '',
        ).not.toContain('👏');
        expect(
            document.querySelector('.lr-overlay')?.textContent ?? '',
        ).not.toContain('hello');
    });

    it('whispers the emoji picked in the grid and closes the popover', () => {
        const presence = renderBar();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction' }),
        );
        fireEvent.click(
            within(
                screen.getByRole('group', { name: 'Send a reaction' }),
            ).getByRole('button', { name: '🤔' }),
        );

        expect(presence.whisper).toHaveBeenCalledWith(
            'reaction',
            expect.objectContaining({ e: '🤔' }),
        );
        expect(
            screen.queryByRole('group', { name: 'Send a reaction' }),
        ).toBeNull();
    });

    it('opens the full emoji search from "More emoji…" when an emoji list exists', () => {
        renderBar(channel(), {}, { emojiData });

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));

        expect(
            screen.getByRole('dialog', { name: 'Send a reaction' }),
        ).toBeTruthy();
    });

    it('hides "More emoji…" without an emoji list', () => {
        renderBar();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction' }),
        );

        expect(
            screen.queryByRole('button', { name: 'More emoji…' }),
        ).toBeNull();
    });

    it('reaches the full emoji search from the drawer of the compact bar', () => {
        renderBar(channel(), {}, { emojiData, compact: true });

        fireEvent.click(screen.getByRole('button', { name: 'More reactions' }));
        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));

        expect(
            screen.getByRole('dialog', { name: 'Send a reaction' }),
        ).toBeTruthy();
    });

    it('makes the picker trigger one stop of the toolbar arrow keys', () => {
        renderBar();

        const trigger = screen.getByRole('button', { name: 'Send a reaction' });
        const lastEmoji = screen.getByRole('button', {
            name: 'Send a reaction 👎',
        });

        expect(trigger.getAttribute('tabindex')).toBe('-1');
        expect(trigger.getAttribute('type')).toBe('button');

        lastEmoji.focus();
        fireEvent.keyDown(lastEmoji, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(trigger);
    });
});
